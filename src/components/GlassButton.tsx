import type { ButtonHTMLAttributes } from 'react';

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** floating: own backdrop blur (on top of the background). inner: sits on a glass panel. primary: play button. */
  variant?: 'floating' | 'inner' | 'primary' | 'plain';
  size?: 's' | 'm' | 'l' | 'pill';
  active?: boolean;
};

export function GlassButton({
  variant = 'inner',
  size = 'm',
  active = false,
  className = '',
  type = 'button',
  ...props
}: GlassButtonProps) {
  const classes = ['glass-button', `glass-button--${variant}`, `glass-button--${size}`, active ? 'is-active' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...props} />;
}
