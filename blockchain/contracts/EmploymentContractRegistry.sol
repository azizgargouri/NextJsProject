// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title EmploymentContractRegistry
 * @notice Dual-signed, self-contained employment contract registry.
 *
 * Signing model:
 *  - HR builds the canonical contract JSON off-chain.
 *  - HR signs the EIP-712 `ContractIntent` (which commits to the document hash).
 *  - The employee signs the exact same intent.
 *  - Either party (or a relayer, normally the app's system wallet) submits the
 *    intent + document + both signatures, and pays the gas.
 *  - The contract verifies both signatures before writing anything, so no block
 *    can contain an employment contract that only one side agreed to.
 *
 * Persistence model:
 *  - The complete canonical document JSON is passed in calldata and stored in
 *    contract storage. It remains recoverable from the chain even if the
 *    application database is lost. Only the hash and the two signatures are
 *    used for verification; the JSON itself is the durable copy.
 *
 * Privacy warning:
 *  - The document is public on-chain. It contains names, emails and salary.
 *    Do not deploy this variant on a public network without encrypting the
 *    document first or accepting that the terms become public.
 *
 * Multi-tenant model:
 *  - The platform owner authorizes HR wallets per organisation.
 *  - `organizationId` is keccak256(bytes(off-chain organisation id)).
 *  - An HR wallet can only sign for the organisation it is authorized for.
 *
 * Lifecycle:
 *  Active -> Terminated
 *  Active -> Superseded (a newer dual-signed version was issued)
 */
contract EmploymentContractRegistry is Ownable, Pausable, EIP712 {
    enum Status {
        None,
        Active,
        Terminated,
        Superseded
    }

    /**
     * @notice What both parties sign. The document itself is not included, only
     *         its hash; the hash commits to the canonical JSON passed alongside
     *         the signatures.
     */
    struct ContractIntent {
        bytes32 organizationId;
        address employer;
        address employee;
        bytes32 employeeRefHash;
        bytes32 documentHash;
        uint64 startDate;
        uint64 endDate; // 0 = open-ended
        bytes32 previousContractId; // 0 for a brand new contract
        uint32 version;
        uint256 nonce;
        uint64 deadline;
    }

    struct EmploymentContract {
        bytes32 id;
        bytes32 organizationId;
        address employer;
        address employee;
        bytes32 employeeRefHash;
        bytes32 documentHash;
        uint64 startDate;
        uint64 endDate;
        uint64 createdAt;
        uint64 acceptedAt;
        uint64 terminatedAt;
        bytes32 terminationReasonHash;
        bytes32 previousContractId;
        bytes32 supersededBy;
        address terminatedBy;
        uint32 version;
        Status status;
        uint256 nonce;
        uint64 deadline;
        string documentUri;
        string document;
        bytes employerSignature;
        bytes employeeSignature;
    }

    bytes32 private constant CONTRACT_INTENT_TYPEHASH = keccak256(
        "ContractIntent(bytes32 organizationId,address employer,address employee,bytes32 employeeRefHash,bytes32 documentHash,uint64 startDate,uint64 endDate,bytes32 previousContractId,uint32 version,uint256 nonce,uint64 deadline)"
    );

    /// @notice What HR (dismissal) or the employee (resignation) signs to end a contract.
    bytes32 private constant TERMINATION_TYPEHASH = keccak256(
        "Termination(bytes32 contractId,bytes32 reasonHash,uint64 deadline)"
    );

    /// @notice Hard cap so an accidental PDF upload cannot make the transaction unusable.
    uint256 public constant MAX_DOCUMENT_BYTES = 16_384;

    /// @notice Contract id => contract record.
    mapping(bytes32 => EmploymentContract) private _contracts;

    /// @notice Organisation => number of contracts ever issued.
    mapping(bytes32 => uint256) private _organizationNonce;

    /// @notice HR wallet => organisation hash (bytes32(0) means not authorized).
    mapping(address => bytes32) public hrOrganization;

    event HrAdminUpdated(address indexed admin, bytes32 indexed organizationId, bool enabled);

    event ContractCreated(
        bytes32 indexed id,
        bytes32 indexed organizationId,
        address indexed employer,
        address employee,
        bytes32 employeeRefHash,
        bytes32 documentHash,
        uint64 startDate,
        uint64 endDate,
        bytes32 previousContractId,
        uint32 version,
        uint256 nonce,
        uint64 deadline,
        string documentUri,
        bytes employerSignature,
        bytes employeeSignature
    );

    event ContractTerminated(
        bytes32 indexed id,
        address indexed terminatedBy,
        bytes32 reasonHash,
        uint64 terminatedAt
    );

    event ContractSuperseded(bytes32 indexed id, bytes32 indexed newContractId);

    error NotHrAdmin();
    error OrganizationMismatch();
    error ContractNotFound();
    error InvalidContractState();
    error NotEmployee();
    error NotAuthorized();
    error InvalidAddress();
    error InvalidDocumentHash();
    error InvalidEmployeeRefHash();
    error InvalidDates();
    error InvalidOrganization();
    error EmptyDocumentUri();
    error EmptyDocument();
    error DocumentTooLarge();
    error DocumentHashMismatch();
    error InvalidEmployerSignature();
    error InvalidEmployeeSignature();
    error SignatureExpired();
    error InvalidNonce();
    error InvalidVersion();
    error InvalidPreviousContract();
    error ContractAlreadyExists();

    constructor(address initialOwner)
        Ownable(initialOwner)
        EIP712("MoveUp Employment Contract Registry", "2")
    {}

    modifier onlyHrAdmin() {
        if (hrOrganization[msg.sender] == bytes32(0)) revert NotHrAdmin();
        _;
    }

    /* ------------------------------------------------------------------ */
    /*                          Administration                            */
    /* ------------------------------------------------------------------ */

    /// @notice Authorizes (or re-authorizes) an HR wallet for an organisation.
    function setHrAdmin(address admin, bytes32 organizationId) external onlyOwner {
        if (admin == address(0)) revert InvalidAddress();
        if (organizationId == bytes32(0)) revert InvalidOrganization();

        hrOrganization[admin] = organizationId;
        emit HrAdminUpdated(admin, organizationId, true);
    }

    /// @notice Revokes an HR wallet. Existing contracts remain on-chain.
    function removeHrAdmin(address admin) external onlyOwner {
        bytes32 organizationId = hrOrganization[admin];
        if (organizationId == bytes32(0)) revert NotHrAdmin();

        delete hrOrganization[admin];
        emit HrAdminUpdated(admin, organizationId, false);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /* ------------------------------------------------------------------ */
    /*                        Contract lifecycle                          */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Creates an active contract only when both signatures are valid.
     * @dev Anyone can submit the transaction (HR, employee or a relayer); the
     *      two EIP-712 signatures are the authority, not `msg.sender`, so
     *      either party (normally the HR admin) can submit and pay the gas.
     * @param intent Terms both parties signed.
     * @param document Canonical contract JSON, also persisted on-chain.
     * @param documentUri Human-readable location (deterministic URN by default).
     * @param employerSignature HR wallet signature over `intent`.
     * @param employeeSignature Employee wallet signature over `intent`.
     */
    function createContract(
        ContractIntent calldata intent,
        string calldata document,
        string calldata documentUri,
        bytes calldata employerSignature,
        bytes calldata employeeSignature
    ) external whenNotPaused returns (bytes32 contractId) {
        if (intent.previousContractId != bytes32(0)) revert InvalidPreviousContract();
        if (intent.version != 1) revert InvalidVersion();

        _verifySignedIntent(intent, document, documentUri, employerSignature, employeeSignature);

        contractId = _contractId(intent);
        if (_contracts[contractId].status != Status.None) revert ContractAlreadyExists();

        _storeContract(
            contractId,
            intent,
            documentUri,
            document,
            employerSignature,
            employeeSignature
        );
        _organizationNonce[intent.organizationId]++;

        emit ContractCreated(
            contractId,
            intent.organizationId,
            intent.employer,
            intent.employee,
            intent.employeeRefHash,
            intent.documentHash,
            intent.startDate,
            intent.endDate,
            intent.previousContractId,
            intent.version,
            intent.nonce,
            intent.deadline,
            documentUri,
            employerSignature,
            employeeSignature
        );
    }

    /**
     * @notice Replaces an active contract with a new dual-signed version.
     *         The previous record becomes `Superseded`; the new one is Active
     *         immediately because both parties already signed it.
     */
    function amendContract(
        bytes32 contractId,
        ContractIntent calldata intent,
        string calldata document,
        string calldata documentUri,
        bytes calldata employerSignature,
        bytes calldata employeeSignature
    ) external whenNotPaused returns (bytes32 newContractId) {
        EmploymentContract storage current = _requireContract(contractId);

        if (current.status != Status.Active) revert InvalidContractState();
        if (current.organizationId != intent.organizationId) revert OrganizationMismatch();
        if (current.employee != intent.employee) revert NotEmployee();
        if (intent.previousContractId != contractId) revert InvalidPreviousContract();
        if (intent.version != current.version + 1) revert InvalidVersion();

        _verifySignedIntent(intent, document, documentUri, employerSignature, employeeSignature);

        newContractId = _contractId(intent);
        if (_contracts[newContractId].status != Status.None) revert ContractAlreadyExists();

        current.status = Status.Superseded;
        current.supersededBy = newContractId;

        _storeContract(
            newContractId,
            intent,
            documentUri,
            document,
            employerSignature,
            employeeSignature
        );
        _organizationNonce[intent.organizationId]++;

        emit ContractCreated(
            newContractId,
            intent.organizationId,
            intent.employer,
            intent.employee,
            intent.employeeRefHash,
            intent.documentHash,
            intent.startDate,
            intent.endDate,
            intent.previousContractId,
            intent.version,
            intent.nonce,
            intent.deadline,
            documentUri,
            employerSignature,
            employeeSignature
        );
        emit ContractSuperseded(contractId, newContractId);
    }

    /**
     * @notice Ends an active contract. The organisation's HR wallet (dismissal /
     *         end of mission) or the employee (resignation) signs a `Termination`
     *         intent; any account — normally the app's system wallet — may then
     *         submit it and pay the gas, so the signed party never spends funds.
     * @param contractId Active contract to end.
     * @param reasonHash keccak256 of an off-chain reason string. Use bytes32(0)
     *        when no reason is recorded.
     * @param deadline Unix time after which the signature is refused.
     * @param signature Employee or HR wallet signature over `Termination`.
     */
    function terminateContract(
        bytes32 contractId,
        bytes32 reasonHash,
        uint64 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        EmploymentContract storage current = _requireContract(contractId);

        if (current.status != Status.Active) revert InvalidContractState();
        if (block.timestamp > deadline) revert SignatureExpired();

        address signer = ECDSA.recover(
            _hashTypedDataV4(
                keccak256(abi.encode(TERMINATION_TYPEHASH, contractId, reasonHash, deadline))
            ),
            signature
        );

        bool isEmployer = hrOrganization[signer] == current.organizationId;
        bool isEmployee = current.employee == signer;
        if (!isEmployer && !isEmployee) revert NotAuthorized();

        current.status = Status.Terminated;
        current.terminatedAt = uint64(block.timestamp);
        current.terminatedBy = signer;
        current.terminationReasonHash = reasonHash;

        emit ContractTerminated(contractId, signer, reasonHash, current.terminatedAt);
    }

    /* ------------------------------------------------------------------ */
    /*                              Views                                 */
    /* ------------------------------------------------------------------ */

    /// @notice Returns the full record, including the on-chain document JSON.
    function getContract(bytes32 contractId)
        external
        view
        returns (EmploymentContract memory)
    {
        return _requireContract(contractId);
    }

    function contractExists(bytes32 contractId) external view returns (bool) {
        return _contracts[contractId].status != Status.None;
    }

    function organizationContractCount(bytes32 organizationId) external view returns (uint256) {
        return _organizationNonce[organizationId];
    }

    function isHrAdminFor(address admin, bytes32 organizationId) external view returns (bool) {
        return hrOrganization[admin] == organizationId && organizationId != bytes32(0);
    }

    /// @notice EIP-712 digest both wallets must sign for a given intent.
    function hashContractIntent(ContractIntent calldata intent) external view returns (bytes32) {
        return _hashTypedDataV4(_structHash(intent));
    }

    /* ------------------------------------------------------------------ */
    /*                              Internal                              */
    /* ------------------------------------------------------------------ */

    function _verifySignedIntent(
        ContractIntent calldata intent,
        string calldata document,
        string calldata documentUri,
        bytes calldata employerSignature,
        bytes calldata employeeSignature
    ) private view {
        if (intent.organizationId == bytes32(0)) revert InvalidOrganization();
        if (intent.employer == address(0) || intent.employee == address(0)) revert InvalidAddress();
        if (intent.employeeRefHash == bytes32(0)) revert InvalidEmployeeRefHash();
        if (intent.documentHash == bytes32(0)) revert InvalidDocumentHash();
        if (intent.deadline == 0 || intent.deadline < block.timestamp) revert SignatureExpired();
        if (intent.nonce == 0) revert InvalidNonce();
        if (intent.endDate != 0 && intent.endDate <= intent.startDate) revert InvalidDates();
        if (bytes(documentUri).length == 0) revert EmptyDocumentUri();
        if (bytes(document).length == 0) revert EmptyDocument();
        if (bytes(document).length > MAX_DOCUMENT_BYTES) revert DocumentTooLarge();
        if (keccak256(bytes(document)) != intent.documentHash) revert DocumentHashMismatch();

        if (hrOrganization[intent.employer] != intent.organizationId) revert NotHrAdmin();

        bytes32 digest = _hashTypedDataV4(_structHash(intent));

        if (ECDSA.recover(digest, employerSignature) != intent.employer) {
            revert InvalidEmployerSignature();
        }
        if (ECDSA.recover(digest, employeeSignature) != intent.employee) {
            revert InvalidEmployeeSignature();
        }
    }

    function _storeContract(
        bytes32 contractId,
        ContractIntent calldata intent,
        string calldata documentUri,
        string calldata document,
        bytes calldata employerSignature,
        bytes calldata employeeSignature
    ) private {
        uint64 nowTimestamp = uint64(block.timestamp);

        _contracts[contractId] = EmploymentContract({
            id: contractId,
            organizationId: intent.organizationId,
            employer: intent.employer,
            employee: intent.employee,
            employeeRefHash: intent.employeeRefHash,
            documentHash: intent.documentHash,
            startDate: intent.startDate,
            endDate: intent.endDate,
            createdAt: nowTimestamp,
            acceptedAt: nowTimestamp,
            terminatedAt: 0,
            terminationReasonHash: bytes32(0),
            previousContractId: intent.previousContractId,
            supersededBy: bytes32(0),
            terminatedBy: address(0),
            version: intent.version,
            status: Status.Active,
            nonce: intent.nonce,
            deadline: intent.deadline,
            documentUri: documentUri,
            document: document,
            employerSignature: employerSignature,
            employeeSignature: employeeSignature
        });
    }

    function _structHash(ContractIntent calldata intent) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    CONTRACT_INTENT_TYPEHASH,
                    intent.organizationId,
                    intent.employer,
                    intent.employee,
                    intent.employeeRefHash,
                    intent.documentHash,
                    intent.startDate,
                    intent.endDate,
                    intent.previousContractId,
                    intent.version,
                    intent.nonce,
                    intent.deadline
                )
            );
    }

    function _contractId(ContractIntent calldata intent) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    intent.organizationId,
                    intent.employee,
                    intent.employeeRefHash,
                    intent.version,
                    intent.nonce
                )
            );
    }

    function _requireContract(bytes32 contractId)
        private
        view
        returns (EmploymentContract storage current)
    {
        current = _contracts[contractId];
        if (current.status == Status.None) revert ContractNotFound();
    }
}
