import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/lib/roles'
import { cn } from '@/lib/utils'

type UserAvatarProps = { name: string; src: string | null; className?: string }

// Content Guidelines §5.3: 32px circle, initials fallback bg-primary text-primary-foreground text-xs.
export function UserAvatar({ name, src, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('size-8', className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
