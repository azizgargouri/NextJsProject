'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoverScorecardCard } from '@/components/features/workspace/mover-scorecard';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { FieldError, Label } from '@/components/ui/field';
import {
  useMoverProfile,
  useRemoveTeamMember,
  useRemoveVehicle,
  useSaveTeamMember,
  useSaveVehicle,
  useUpdateMoverProfile,
  useUploadDocument,
} from '@/hooks/content/mover';
import type {
  MoverDocumentDto,
  MoverDocumentType,
  MoverProfileDto,
  TeamMemberDto,
  VehicleDto,
  VehicleType,
} from '@/types';
import {
  apiErrorMessage,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageTitle,
  Panel,
  Tag,
  TextInput,
} from './mover-ui';

const VEHICLE_LABELS: Record<VehicleType, string> = {
  VAN: 'Van',
  SMALL_TRUCK: 'Small truck',
  LARGE_TRUCK: 'Large truck',
};

const DOCUMENT_TYPES: {
  type: MoverDocumentType;
  label: string;
  needsExpiry: boolean;
  hint: string;
}[] = [
  { type: 'INSURANCE', label: 'Insurance', needsExpiry: true, hint: 'Required to receive offers.' },
  { type: 'LICENCE', label: 'Licence', needsExpiry: false, hint: '' },
  { type: 'REGISTRATION', label: 'Vehicle registration', needsExpiry: false, hint: '' },
  { type: 'ID', label: 'ID', needsExpiry: false, hint: '' },
];

const SELECT_CLASS =
  'mono flex h-12 w-full border border-ink bg-paper px-3 text-[13px] normal-case! tracking-normal! text-ink focus-visible:border-hazard focus-visible:outline-none';

function SaveError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-hazard-dark">
      {message}
    </p>
  );
}

/** Removal is one tap away from data loss, so it asks once more in place. */
function RemoveButton({
  label,
  pending,
  onConfirm,
}: {
  label: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <span className="flex gap-1">
      <Button
        size="sm"
        variant="primary"
        disabled={pending}
        onClick={onConfirm}
        aria-label={`Confirm removing ${label}`}
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
        Keep
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="ghost" aria-label={`Remove ${label}`} onClick={() => setArmed(true)}>
      Remove
    </Button>
  );
}

const CompanySchema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(120),
  taxId: z.string().trim().max(40),
  bio: z.string().trim().max(1000),
});

function CompanyPanel({ profile }: { profile: MoverProfileDto }) {
  const update = useUpdateMoverProfile();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(CompanySchema),
    defaultValues: { companyName: profile.companyName, taxId: profile.taxId, bio: profile.bio },
  });

  return (
    <Panel title="Company">
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit((values) =>
          update.mutate(values, {
            onSuccess: () => {
              reset(values);
              toast.success('Profile saved');
            },
          }),
        )}
      >
        <div>
          <Label htmlFor="company-name">Company name</Label>
          <TextInput
            id="company-name"
            aria-invalid={Boolean(errors.companyName)}
            {...register('companyName')}
          />
          <FieldError message={errors.companyName?.message} />
        </div>
        <div>
          <Label htmlFor="company-tax">Tax ID</Label>
          <TextInput id="company-tax" aria-invalid={Boolean(errors.taxId)} {...register('taxId')} />
          <FieldError message={errors.taxId?.message} />
        </div>
        <div>
          <Label htmlFor="company-bio">About your company</Label>
          <textarea
            id="company-bio"
            rows={4}
            aria-invalid={Boolean(errors.bio)}
            className="w-full border border-ink bg-paper px-3 py-2 text-sm text-ink focus-visible:border-hazard focus-visible:outline-none"
            {...register('bio')}
          />
          <FieldError message={errors.bio?.message} />
        </div>
        <SaveError message={update.isError ? apiErrorMessage(update.error) : null} />
        <Button type="submit" className="self-start" disabled={update.isPending || !isDirty}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-ink pt-4 text-sm">
        <dt className="text-ink-80">Account</dt>
        <dd className="break-all">{profile.account.email}</dd>
        <dt className="text-ink-80">Phone</dt>
        <dd>{profile.account.phone}</dd>
        <dt className="text-ink-80">Rating</dt>
        <dd>
          {profile.ratingCount > 0
            ? `${profile.ratingAvg.toFixed(1)} from ${profile.ratingCount} reviews`
            : 'No reviews yet'}
        </dd>
      </dl>
    </Panel>
  );
}

const number = (max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value !== '' && Number(value) >= 0 && Number(value) <= max, message);

const CostsSchema = z.object({
  fuelLitresPer100Km: number(100, 'Enter 0 to 100 litres'),
  fuelPricePerLitre: number(20, 'Enter a price from 0 to 20 TND'),
  helpers: number(20, 'Enter 0 to 20 helpers').refine(
    (value) => Number.isInteger(Number(value)),
    'Enter a whole number',
  ),
  helperHourlyRate: number(500, 'Enter a rate from 0 to 500 TND'),
  costPerKm: number(20, 'Enter 0 to 20 TND'),
  targetHourlyNet: number(1000, 'Enter 0 to 1000 TND'),
});

const COST_FIELDS: { name: keyof z.infer<typeof CostsSchema>; label: string; step: string }[] = [
  { name: 'fuelLitresPer100Km', label: 'Fuel use (litres per 100 km)', step: '0.1' },
  { name: 'fuelPricePerLitre', label: 'Fuel price (TND per litre)', step: '0.001' },
  { name: 'helpers', label: 'Helpers on a usual job', step: '1' },
  { name: 'helperHourlyRate', label: 'Pay per helper (TND per hour)', step: '0.5' },
  { name: 'costPerKm', label: 'Wear and upkeep (TND per km)', step: '0.01' },
  { name: 'targetHourlyNet', label: 'What you want to earn (TND per hour)', step: '1' },
];

function costsAsText(costs: MoverProfileDto['costs']) {
  return Object.fromEntries(COST_FIELDS.map(({ name }) => [name, String(costs[name])])) as z.infer<
    typeof CostsSchema
  >;
}

/** Feeds the profitability estimate on every offer. */
function CostsPanel({ profile }: { profile: MoverProfileDto }) {
  const update = useUpdateMoverProfile();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(CostsSchema),
    defaultValues: costsAsText(profile.costs),
  });

  // Offers link here; the section only exists once the profile has loaded.
  useEffect(() => {
    if (window.location.hash === '#costs') {
      document.getElementById('costs')?.scrollIntoView({ block: 'start' });
    }
  }, []);

  const resetToDefaults = () =>
    update.mutate(
      { costs: null },
      {
        onSuccess: () => toast.success('Back to the default costs'),
      },
    );

  return (
    <div id="costs" className="scroll-mt-24">
      <Panel title="My costs">
        <p className="mb-4 text-sm text-ink-80">
          {profile.costsAreDefaults
            ? 'These are default values. Enter your own, so the estimate on each offer shows what the job really leaves you.'
            : 'Used to work out what each offer leaves you after fuel, helpers and wear.'}
        </p>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={handleSubmit((values) => {
            const costs: MoverProfileDto['costs'] = {
              fuelLitresPer100Km: Number(values.fuelLitresPer100Km),
              fuelPricePerLitre: Number(values.fuelPricePerLitre),
              helpers: Number(values.helpers),
              helperHourlyRate: Number(values.helperHourlyRate),
              costPerKm: Number(values.costPerKm),
              targetHourlyNet: Number(values.targetHourlyNet),
            };
            update.mutate(
              { costs },
              {
                onSuccess: () => {
                  reset(values);
                  toast.success('Costs saved');
                },
              },
            );
          })}
        >
          {COST_FIELDS.map((field) => (
            <div key={field.name}>
              <Label htmlFor={`cost-${field.name}`}>{field.label}</Label>
              <TextInput
                id={`cost-${field.name}`}
                type="number"
                inputMode="decimal"
                min="0"
                step={field.step}
                aria-invalid={Boolean(errors[field.name])}
                {...register(field.name)}
              />
              <FieldError message={errors[field.name]?.message} />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <SaveError message={update.isError ? apiErrorMessage(update.error) : null} />
            <Button type="submit" disabled={update.isPending || !isDirty}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            {!profile.costsAreDefaults ? (
              <Button
                type="button"
                variant="ghost"
                disabled={update.isPending}
                onClick={resetToDefaults}
              >
                Use the defaults
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}

const VehicleFormSchema = z.object({
  type: z.enum(['VAN', 'SMALL_TRUCK', 'LARGE_TRUCK']),
  capacityM3: z
    .string()
    .refine(
      (value) => Number(value) > 0 && Number(value) <= 200,
      'Enter a capacity from 1 to 200 m³',
    ),
  plate: z.string().trim().min(2, 'Enter the plate number').max(20),
});

function VehicleForm({ vehicle, onDone }: { vehicle?: VehicleDto; onDone: () => void }) {
  const save = useSaveVehicle();
  const prefix = vehicle?.id ?? 'new';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(VehicleFormSchema),
    defaultValues: {
      type: vehicle?.type ?? 'VAN',
      capacityM3: vehicle ? String(vehicle.capacityM3) : '',
      plate: vehicle?.plate ?? '',
    },
  });

  return (
    <form
      className="flex flex-col gap-3 border border-ink p-3"
      noValidate
      onSubmit={handleSubmit((values) =>
        save.mutate(
          { id: vehicle?.id, payload: { ...values, capacityM3: Number(values.capacityM3) } },
          { onSuccess: onDone },
        ),
      )}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${prefix}-type`}>Type</Label>
          <select id={`${prefix}-type`} className={SELECT_CLASS} {...register('type')}>
            {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`${prefix}-capacity`}>Capacity (m³)</Label>
          <TextInput
            id={`${prefix}-capacity`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            aria-invalid={Boolean(errors.capacityM3)}
            {...register('capacityM3')}
          />
          <FieldError message={errors.capacityM3?.message} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-plate`}>Plate</Label>
          <TextInput
            id={`${prefix}-plate`}
            aria-invalid={Boolean(errors.plate)}
            {...register('plate')}
          />
          <FieldError message={errors.plate?.message} />
        </div>
      </div>
      <SaveError message={save.isError ? apiErrorMessage(save.error) : null} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save vehicle'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function VehiclesPanel({ vehicles }: { vehicles: VehicleDto[] }) {
  const remove = useRemoveVehicle();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <Panel
      title="Vehicles"
      action={
        editing === null ? (
          <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
            Add
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {editing === 'new' ? <VehicleForm onDone={() => setEditing(null)} /> : null}
        {vehicles.length === 0 && editing !== 'new' ? (
          <EmptyState title="No vehicles added" />
        ) : null}
        {vehicles.map((vehicle) =>
          editing === vehicle.id ? (
            <VehicleForm key={vehicle.id} vehicle={vehicle} onDone={() => setEditing(null)} />
          ) : (
            <Row
              key={vehicle.id}
              title={`${VEHICLE_LABELS[vehicle.type]}, ${vehicle.capacityM3} m³`}
              detail={vehicle.plate}
              onEdit={() => setEditing(vehicle.id)}
              remove={
                <RemoveButton
                  label={vehicle.plate}
                  pending={remove.isPending}
                  onConfirm={() =>
                    remove.mutate(vehicle.id, {
                      onError: (error) => toast.error(apiErrorMessage(error)),
                    })
                  }
                />
              }
            />
          ),
        )}
      </div>
    </Panel>
  );
}

function Row({
  title,
  detail,
  onEdit,
  remove,
}: {
  title: string;
  detail: string;
  onEdit: () => void;
  remove: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-ink p-3">
      <div className="min-w-0">
        <p className="font-bold">{title}</p>
        {detail ? <p className="text-sm text-ink-80">{detail}</p> : null}
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${title}`}>
          Edit
        </Button>
        {remove}
      </div>
    </div>
  );
}

const TeamFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  phone: z.string().trim().max(20),
  role: z.string().trim().max(60),
});

function TeamForm({ member, onDone }: { member?: TeamMemberDto; onDone: () => void }) {
  const save = useSaveTeamMember();
  const prefix = member?.id ?? 'new-member';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(TeamFormSchema),
    defaultValues: {
      name: member?.name ?? '',
      phone: member?.phone ?? '',
      role: member?.role ?? '',
    },
  });

  return (
    <form
      className="flex flex-col gap-3 border border-ink p-3"
      noValidate
      onSubmit={handleSubmit((values) =>
        save.mutate({ id: member?.id, payload: values }, { onSuccess: onDone }),
      )}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${prefix}-name`}>Name</Label>
          <TextInput
            id={`${prefix}-name`}
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-phone`}>Phone (optional)</Label>
          <TextInput id={`${prefix}-phone`} type="tel" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-role`}>Role (optional)</Label>
          <TextInput id={`${prefix}-role`} {...register('role')} />
          <FieldError message={errors.role?.message} />
        </div>
      </div>
      <SaveError message={save.isError ? apiErrorMessage(save.error) : null} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save member'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TeamPanel({ team }: { team: TeamMemberDto[] }) {
  const remove = useRemoveTeamMember();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <Panel
      title="Team"
      action={
        editing === null ? (
          <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
            Add
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {editing === 'new' ? <TeamForm onDone={() => setEditing(null)} /> : null}
        {team.length === 0 && editing !== 'new' ? (
          <EmptyState title="No team members added" />
        ) : null}
        {team.map((member) =>
          editing === member.id ? (
            <TeamForm key={member.id} member={member} onDone={() => setEditing(null)} />
          ) : (
            <Row
              key={member.id}
              title={member.name}
              detail={[member.role, member.phone].filter(Boolean).join(', ')}
              onEdit={() => setEditing(member.id)}
              remove={
                <RemoveButton
                  label={member.name}
                  pending={remove.isPending}
                  onConfirm={() =>
                    remove.mutate(member.id, {
                      onError: (error) => toast.error(apiErrorMessage(error)),
                    })
                  }
                />
              }
            />
          ),
        )}
      </div>
    </Panel>
  );
}

function DocumentRow({
  spec,
  current,
}: {
  spec: (typeof DOCUMENT_TYPES)[number];
  current?: MoverDocumentDto;
}) {
  const upload = useUploadDocument();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = `document-${spec.type}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return setError('Choose a file first');
    if (spec.needsExpiry && !expiresAt) return setError('Enter the expiry date');
    setError(null);
    upload.mutate(
      { type: spec.type, file, expiresAt: expiresAt || undefined },
      {
        onSuccess: () => {
          toast.success(`${spec.label} uploaded`);
          setOpen(false);
          setFile(null);
          setExpiresAt('');
        },
        onError: (uploadError) => setError(apiErrorMessage(uploadError)),
      },
    );
  };

  return (
    <div className="border border-ink p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {spec.label}
            {current?.state === 'EXPIRED' ? <Tag tone="alert">Expired</Tag> : null}
            {current?.state === 'EXPIRING' ? (
              <Tag tone="alert">
                Expires in {current.daysLeft} {current.daysLeft === 1 ? 'day' : 'days'}
              </Tag>
            ) : null}
            {!current ? <Tag>Missing</Tag> : null}
          </p>
          {current ? (
            <p className="text-sm text-ink-80">
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="break-all underline underline-offset-2"
              >
                {current.fileName || 'View file'}
              </a>
              {current.expiresAt ? `. Valid until ${current.expiresAt.slice(0, 10)}` : ''}
            </p>
          ) : spec.hint ? (
            <p className="text-sm text-ink-80">{spec.hint}</p>
          ) : null}
        </div>
        {!open ? (
          <Button
            size="sm"
            variant="outline"
            aria-label={`${current ? 'Replace' : 'Upload'} ${spec.label}`}
            onClick={() => setOpen(true)}
          >
            {current ? 'Replace' : 'Upload'}
          </Button>
        ) : null}
      </div>

      {open ? (
        <form
          onSubmit={submit}
          className="mt-3 flex flex-col gap-3 border-t border-ink pt-3"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-file`}>File (PDF, JPEG, PNG or WebP, up to 8 MB)</Label>
              <input
                id={`${id}-file`}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="block w-full border border-ink p-2 text-sm"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label htmlFor={`${id}-expiry`}>
                Expiry date{spec.needsExpiry ? '' : ' (optional)'}
              </Label>
              <TextInput
                id={`${id}-expiry`}
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
          </div>
          <SaveError message={error} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={upload.isPending}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function DocumentsPanel({ documents }: { documents: MoverDocumentDto[] }) {
  const needsAttention = documents.filter((document) => document.state !== 'VALID');
  return (
    <Panel title="Documents">
      {needsAttention.length > 0 ? (
        <div className="mb-3">
          <Notice>
            Offers stop when your insurance or any other document expires. Upload a new one in time.
          </Notice>
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        {DOCUMENT_TYPES.map((spec) => (
          <DocumentRow
            key={spec.type}
            spec={spec}
            current={documents.find((document) => document.type === spec.type)}
          />
        ))}
      </div>
    </Panel>
  );
}

/** Item 11: profile, vehicles, team and documents (M-10 + spec 9.3). */
/** Member 6's AI trust scorecard and the public page clients see before booking. */
function ReputationPanel({ companyName }: { companyName: string }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  return (
    <Panel
      title="Reputation"
      className="lg:col-span-2"
      action={
        <Link
          href={`/movers/${user.id}`}
          target="_blank"
          className="mono inline-flex items-center gap-1.5 text-[11px] underline-offset-4 hover:text-hazard hover:underline"
        >
          Public page <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="p-4">
        <MoverScorecardCard moverId={user.id} moverName={companyName || user.name} />
      </div>
    </Panel>
  );
}

export function ProfilePortal() {
  const profile = useMoverProfile();
  if (profile.isPending) return <LoadingState label="Loading profile" />;
  if (profile.isError)
    return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  return (
    <>
      <PageTitle title="Profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <CompanyPanel profile={profile.data} />
        <DocumentsPanel documents={profile.data.documents} />
        <VehiclesPanel vehicles={profile.data.vehicles} />
        <TeamPanel team={profile.data.team} />
        <CostsPanel key={JSON.stringify(profile.data.costs)} profile={profile.data} />
        <ReputationPanel companyName={profile.data.companyName} />
      </div>
    </>
  );
}
