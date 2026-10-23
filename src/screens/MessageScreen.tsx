import type { ReactNode } from 'react';

type MessageScreenProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function MessageScreen({ title, children, actions }: MessageScreenProps) {
  return (
    <main className="screen center-screen">
      <div className="message-card glass glass--text" role="alert">
        <h1 className="message-card__title">{title}</h1>
        <div className="message-card__text">{children}</div>
        {actions && <div className="message-card__actions">{actions}</div>}
      </div>
    </main>
  );
}
