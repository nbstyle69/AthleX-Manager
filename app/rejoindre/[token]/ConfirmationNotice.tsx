import * as React from 'react';

/**
 * Après une inscription par invitation, la confirmation d'e-mail est la seule
 * chose qui sépare l'adhérent de sa première connexion : elle se dit avant
 * « télécharge l'app », et avec l'adresse à laquelle le mail est parti.
 */
export function ConfirmationNotice({
  needsConfirmation,
  email,
  j,
}: {
  needsConfirmation: boolean;
  email: string;
  j: { confirmBefore: string; confirmAfter: string };
}) {
  if (!needsConfirmation) return null;
  return (
    <div
      data-testid="confirmation-notice"
      className="mt-4 bg-ax-hover border border-ax-border rounded-ax-control px-4 py-3 text-left"
    >
      <p className="text-sm text-ax-text">
        {j.confirmBefore}
        <span className="font-semibold">{email}</span>
        {j.confirmAfter}
      </p>
    </div>
  );
}
