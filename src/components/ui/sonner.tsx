"use client"

import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Content Guidelines §6.8: top-right; 4px left border + icon per type (success green-500 /
// CheckCircle2, error destructive / XCircle, warning amber-500 / AlertTriangle, info primary /
// Info); max 3 stacked; close button on hover. Durations are set per call (4000 / 6000 ms).
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as NonNullable<ToasterProps["theme"]>}
      position="top-right"
      visibleToasts={3}
      closeButton
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="size-4 text-chart-good" aria-hidden="true" />,
        info: <Info className="size-4 text-primary" aria-hidden="true" />,
        warning: <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />,
        error: <XCircle className="size-4 text-destructive" aria-hidden="true" />,
        loading: <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded !border-l-4 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          success: "!border-l-chart-good",
          error: "!border-l-destructive",
          warning: "!border-l-amber-500",
          info: "!border-l-primary",
          description: "group-[.toast]:text-muted-foreground",
          closeButton:
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-[.toast]:bg-background group-[.toast]:border-border",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
