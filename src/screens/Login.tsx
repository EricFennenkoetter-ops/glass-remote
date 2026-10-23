import { useState } from 'react';
import { AuthError, importSessionCode, isStandalone, startLogin } from '../auth/session';
import { GlassButton } from '../components/GlassButton';
import { Icon } from '../components/Icon';

type LoginProps = { error: AuthError | null };

export function Login({ error }: LoginProps) {
  const [busy, setBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [code, setCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const standalone = isStandalone();

  const connect = async () => {
    setBusy(true);
    try {
      await startLogin();
    } catch {
      setBusy(false);
    }
  };

  const importCode = async () => {
    setImportError(null);
    setBusy(true);
    try {
      await importSessionCode(code);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Das hat nicht geklappt.');
      setBusy(false);
    }
  };

  return (
    <main className="screen center-screen login">
      <div className="login__brand">
        <div className="login__logo glass glass--floating">
          <Icon name="play" size={44} />
        </div>
        <h1 className="login__title">Glass Remote</h1>
        <p className="login__subtitle">Steuere die Spotify-App – mit einem Hauch Glas.</p>
      </div>

      {error && (
        <div className="notice glass glass--text" role="alert">
          {error.message}
          {error.kind === 'wrong-context' && standalone && (
            <> Tippe unten auf „Anmeldung einfügen“, falls es erneut passiert.</>
          )}
        </div>
      )}

      <GlassButton variant="floating" size="pill" className="login__button" onClick={() => void connect()} disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        Mit Spotify verbinden
      </GlassButton>

      {standalone && (
        <div className="login__fallback">
          {showImport ? (
            <form
              className="import-form glass glass--text"
              onSubmit={(event) => {
                event.preventDefault();
                void importCode();
              }}
            >
              <label htmlFor="import-code">Übertragungscode aus Safari</label>
              <input
                id="import-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="glassremote1.…"
              />
              {importError && <p className="import-form__error">{importError}</p>}
              <GlassButton variant="primary" size="pill" type="submit" disabled={busy || !code.trim()}>
                Anmeldung einfügen
              </GlassButton>
            </form>
          ) : (
            <button type="button" className="text-link" onClick={() => setShowImport(true)}>
              Login klappt nicht? Anmeldung einfügen
            </button>
          )}
        </div>
      )}

      <p className="login__footnote">Spotify Premium erforderlich. Die Musik läuft weiter in der Spotify-App.</p>
    </main>
  );
}
