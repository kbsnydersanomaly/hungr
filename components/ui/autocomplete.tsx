"use client"

import * as React from "react"
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"

import { cn } from "@/lib/utils"

const Autocomplete = AutocompletePrimitive.Root

function AutocompleteInput({
  className,
  ...props
}: AutocompletePrimitive.Input.Props) {
  return (
    <AutocompletePrimitive.Input
      data-slot="autocomplete-input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

function AutocompleteContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: Omit<AutocompletePrimitive.Popup.Props, "children"> &
  Pick<AutocompletePrimitive.Positioner.Props, "sideOffset"> & {
    children?: AutocompletePrimitive.List.Props["children"]
  }) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          className={cn(
            "relative isolate z-50 max-h-[min(20rem,var(--available-height))] w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <AutocompletePrimitive.List>{children}</AutocompletePrimitive.List>
        </AutocompletePrimitive.Popup>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  )
}

function AutocompleteItem({
  className,
  ...props
}: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

interface TagAutocompleteProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}

/**
 * Free-text input with suggestions sourced from previously entered values
 * (e.g. option names like "Fries" reused across menu items).
 */
function TagAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
}: TagAutocompleteProps) {
  return (
    <Autocomplete
      items={suggestions}
      value={value}
      onValueChange={(v) => onChange(v)}
      openOnInputClick
    >
      <AutocompleteInput placeholder={placeholder} className={className} />
      {suggestions.length > 0 && (
        <AutocompleteContent>
          {(suggestion: string) => (
            <AutocompleteItem key={suggestion} value={suggestion}>
              {suggestion}
            </AutocompleteItem>
          )}
        </AutocompleteContent>
      )}
    </Autocomplete>
  )
}

export {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteItem,
  TagAutocomplete,
}
