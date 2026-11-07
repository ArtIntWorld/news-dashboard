import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Field,
  Label,
} from '@headlessui/react'
import { useMemo, useState } from 'react'
import type { Country } from '../api/types'
import { filterCountries } from '../lib/country'
import { ChevronDownIcon, GlobeIcon } from './icons'

interface Props {
  value: string | null
  onChange: (code: string) => void
  countries: readonly Country[]
  disabled?: boolean
}

export default function CountrySelect({ value, onChange, countries, disabled }: Props) {
  const [query, setQuery] = useState('')
  const selected = useMemo(
    () => countries.find((c) => c.code === value) ?? null,
    [countries, value],
  )
  const filtered = useMemo(() => filterCountries(countries, query), [countries, query])

  return (
    <Field disabled={disabled} className="w-full">
      <Label className="sr-only">Country</Label>
      <Combobox
        value={selected}
        by="code"
        onChange={(c: Country | null) => {
          if (c) onChange(c.code)
        }}
        onClose={() => setQuery('')}
        immediate
      >
        <div className="relative">
          <GlobeIcon className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 text-muted" />
          <ComboboxInput
            className="w-full rounded-xl border border-line bg-panel py-2.5 pr-11 pl-11 text-[15px] font-medium text-ink backdrop-blur placeholder:font-normal placeholder:text-faint focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 data-disabled:opacity-60 sm:py-3"
            displayValue={(c: Country | null) => c?.name ?? ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={disabled ? 'Loading countries…' : 'Search countries'}
            autoComplete="off"
            spellCheck={false}
          />
          <ComboboxButton
            aria-label="Show all countries"
            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3.5 text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronDownIcon className="size-5" />
          </ComboboxButton>
        </div>

        <ComboboxOptions
          anchor="bottom"
          transition
          className="z-40 w-(--input-width) rounded-xl border border-line bg-panel-solid p-1 text-sm shadow-xl [--anchor-gap:6px] [--anchor-max-height:18rem] empty:invisible focus:outline-none data-closed:opacity-0 motion-safe:transition-opacity motion-safe:duration-100"
        >
          {filtered.map((country) => (
            <ComboboxOption
              key={country.code}
              value={country}
              className="flex cursor-default items-center justify-between rounded-lg px-3 py-2 text-ink select-none data-focus:bg-accent-soft data-selected:font-semibold data-selected:text-accent-ink"
            >
              {country.name}
              <span className="text-xs text-faint">{country.code}</span>
            </ComboboxOption>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-muted">No countries match</div>}
        </ComboboxOptions>
      </Combobox>
      <span className="sr-only" aria-live="polite">
        {query ? `${filtered.length} ${filtered.length === 1 ? 'country' : 'countries'} found` : ''}
      </span>
    </Field>
  )
}
