-- Add region column with default to vpn_servers table
ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Europe';

-- Add obfuscated column with default to vpn_servers table
ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS obfuscated BOOLEAN NOT NULL DEFAULT false;

-- Add double_hop column with default to vpn_servers table
ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS double_hop BOOLEAN NOT NULL DEFAULT false;

-- Update existing servers with region information based on country
UPDATE vpn_servers SET region = 'Europe' WHERE country IN ('Netherlands', 'UK', 'Germany', 'France', 'Spain', 'Italy', 'Sweden', 'Switzerland');
UPDATE vpn_servers SET region = 'North America' WHERE country IN ('US', 'Canada', 'Mexico');
UPDATE vpn_servers SET region = 'Asia Pacific' WHERE country IN ('Singapore', 'Japan', 'Australia', 'South Korea', 'India');
UPDATE vpn_servers SET region = 'Africa' WHERE country IN ('Nigeria', 'South Africa', 'Kenya', 'Egypt');
UPDATE vpn_servers SET region = 'Middle East' WHERE country IN ('UAE', 'Saudi Arabia', 'Israel', 'Turkey');

-- Update obfuscated servers (typically used to bypass firewalls in restrictive countries)
UPDATE vpn_servers SET obfuscated = true WHERE name LIKE '%Obfuscated%';

-- Update double-hop servers (for enhanced privacy and security)
UPDATE vpn_servers SET double_hop = true WHERE name LIKE '%Double%' OR name LIKE '%Multi-hop%';