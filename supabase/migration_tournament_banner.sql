-- Migration: Ajouter banner_url aux tournois + bucket storage
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter la colonne banner_url à la table tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS banner_url text;

-- 2. Créer le bucket storage pour les banners de tournoi (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-banners', 'tournament-banners', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy: permettre l'upload aux utilisateurs authentifiés
CREATE POLICY "Authenticated users can upload tournament banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tournament-banners');

-- 4. Policy: permettre la mise à jour (upsert) aux utilisateurs authentifiés
CREATE POLICY "Authenticated users can update tournament banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tournament-banners');

-- 5. Policy: lecture publique des banners
CREATE POLICY "Public read access for tournament banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tournament-banners');
