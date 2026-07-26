-- Box-level "Conditions générales" (CGV) PDF, uploaded by the owner and shown
-- to prospective members before payment + in the athlete account.
-- Stored publicly in the existing `box-logos` bucket (public), URL kept on the box.

ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS terms_pdf_url text;
