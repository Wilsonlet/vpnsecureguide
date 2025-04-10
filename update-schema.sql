-- Add new fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS subscription_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS data_limit INTEGER DEFAULT 1073741824, -- 1GB for free tier
ADD COLUMN IF NOT EXISTS daily_time_limit INTEGER DEFAULT 60; -- 60 minutes for free tier

-- Create subscription_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price INTEGER NOT NULL,
  data_limit INTEGER NOT NULL,
  daily_time_limit INTEGER NOT NULL,
  server_access TEXT NOT NULL DEFAULT 'standard',
  max_devices INTEGER NOT NULL DEFAULT 1,
  double_vpn_access BOOLEAN DEFAULT FALSE,
  obfuscation_access BOOLEAN DEFAULT FALSE,
  ad_free BOOLEAN DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT
);

-- Add subscription plan data
INSERT INTO subscription_plans (name, price, data_limit, daily_time_limit, server_access, max_devices, double_vpn_access, obfuscation_access, ad_free, priority)
VALUES 
('Free', 0, 1073741824, 60, 'standard', 1, FALSE, FALSE, FALSE, 0)
ON CONFLICT (name) DO NOTHING;

INSERT INTO subscription_plans (name, price, data_limit, daily_time_limit, server_access, max_devices, double_vpn_access, obfuscation_access, ad_free, priority)
VALUES 
('Basic', 499, 10737418240, 240, 'standard', 2, FALSE, FALSE, TRUE, 1)
ON CONFLICT (name) DO NOTHING;

INSERT INTO subscription_plans (name, price, data_limit, daily_time_limit, server_access, max_devices, double_vpn_access, obfuscation_access, ad_free, priority)
VALUES 
('Premium', 999, 53687091200, 1440, 'premium', 5, TRUE, FALSE, TRUE, 2)
ON CONFLICT (name) DO NOTHING;

INSERT INTO subscription_plans (name, price, data_limit, daily_time_limit, server_access, max_devices, double_vpn_access, obfuscation_access, ad_free, priority)
VALUES 
('Ultimate', 1999, 107374182400, 1440, 'all', 10, TRUE, TRUE, TRUE, 3)
ON CONFLICT (name) DO NOTHING;