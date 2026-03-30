import { agentAvatarSrc } from '@mission-control/types';

type AgentAvatarProps = {
  avatarId: string | null;
  /** CSS pixel size (width & height). Default 40. */
  size?: number;
  className?: string;
};

export function AgentAvatar({ avatarId, size = 40, className = '' }: AgentAvatarProps) {
  return (
    <img
      src={agentAvatarSrc(avatarId)}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`rounded border border-gray-700 bg-gray-950 shrink-0 [image-rendering:pixelated] ${className}`}
    />
  );
}
