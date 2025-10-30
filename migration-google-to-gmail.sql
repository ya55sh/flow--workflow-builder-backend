-- Migration: Rename 'google' to 'gmail' in user_app table
-- This fixes the naming inconsistency between OAuth provider (google) and service name (gmail)
-- Date: 2025-10-24

-- Show existing records before migration
SELECT id, appName, user_id, created_at 
FROM user_app 
WHERE appName = 'google';

-- Update appName from 'google' to 'gmail'
UPDATE user_app 
SET appName = 'gmail' 
WHERE appName = 'google';

-- Verify the migration
SELECT id, appName, user_id, created_at 
FROM user_app 
WHERE appName = 'gmail';

-- Expected result: All 'google' entries should now be 'gmail'
-- OAuth credentials will still use GOOGLE_* environment variables via the oauthProvider mapping

