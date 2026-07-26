-- Box-level "Conditions générales" (CGV) PDF, uploaded by the owner and shown
-- to prospective members before payment + in the athlete account.
-- Stored publicly in the existing `box-logos` bucket (public), URL kept on the box.

ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS terms_pdf_url text;

-- The public /box/[slug] page reads this column with the anon key. New columns
-- are not covered by the existing column-level SELECT grants, so grant it
-- explicitly (otherwise the public page 404s with "permission denied").
GRANT SELECT (terms_pdf_url) ON public.boxes TO anon, authenticated;
