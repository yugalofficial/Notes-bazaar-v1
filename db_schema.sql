
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Products Table
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text,
  exam_type text, -- 'SSC', 'Banking', 'UPSC', 'Railways', 'General'
  description text,
  price numeric not null,
  original_price numeric,
  preview_images text[], -- Array of image URLs
  file_url text, -- The secure download link (PDF)
  rating numeric default 5.0,
  reviews_count integer default 0,
  is_bestseller boolean default false,
  students_bought text default '0',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Orders Table
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_email text not null,
  amount numeric not null,
  status text check (status in ('paid', 'pending', 'failed')) default 'pending',
  product_id text not null, -- References product ID
  payment_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Settings Table
create table if not exists public.settings (
  id serial primary key,
  razorpay_key text,
  paypal_client_id text,
  enable_razorpay boolean default true,
  enable_paypal boolean default false,
  emailjs_service_id text,
  emailjs_template_id text,
  emailjs_public_key text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable Row Level Security (RLS)
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.settings enable row level security;

-- 5. RLS Policies

-- Products: Everyone can view, only Admins can edit
drop policy if exists "Public products are viewable by everyone" on public.products;
create policy "Public products are viewable by everyone" 
on public.products for select using (true);

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" 
on public.products for insert 
with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" 
on public.products for update 
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" 
on public.products for delete 
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Orders: Users view/create their own, Admins view all
drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders" 
on public.orders for select 
using ((auth.jwt() ->> 'email') = user_email);

drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" 
on public.orders for select 
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "Users can create orders" on public.orders;
create policy "Users can create orders" 
on public.orders for insert 
with check (true); 

-- Settings: Public read (for keys), Admin write
drop policy if exists "Settings are viewable by everyone" on public.settings;
create policy "Settings are viewable by everyone" 
on public.settings for select using (true);

drop policy if exists "Admins can update settings" on public.settings;
create policy "Admins can update settings" 
on public.settings for update 
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can insert settings" on public.settings;
create policy "Admins can insert settings" 
on public.settings for insert 
with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 6. Insert Mock Data (Only if tables are empty to avoid duplicates)
do $$
begin
  if not exists (select 1 from public.products limit 1) then
    insert into public.products (title, category, exam_type, description, price, original_price, preview_images, file_url, is_bestseller, students_bought)
    values 
    ('Ancient History Masterclass', 'History', 'UPSC', 'Complete ancient history notes covering Indus Valley to Gupta Empire.', 199, 499, ARRAY['https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600'], 'https://example.com/demo.pdf', true, '12K+'),
    ('English Grammar Rules', 'English', 'SSC', '100 Golden rules of Grammar for SSC CGL and CHSL.', 149, 299, ARRAY['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600'], 'https://example.com/demo.pdf', false, '5.2K+'),
    ('Banking Awareness Vol. 1', 'General Awareness', 'Banking', 'Essential banking terminology and current affairs.', 99, 199, ARRAY['https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600'], 'https://example.com/demo.pdf', false, '3.1K+'),
    ('Advanced Math - Geometry', 'Maths', 'SSC', 'Shortcuts and tricks for geometry problems.', 249, 499, ARRAY['https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600'], 'https://example.com/demo.pdf', true, '8.9K+'),
    ('Railway Special GS', 'Science', 'Railways', 'General Science for RRB NTPC and Group D.', 129, 249, ARRAY['https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600'], 'https://example.com/demo.pdf', false, '2.4K+'),
    ('International Relations 2024', 'Polity', 'UPSC', 'Comprehensive coverage of Indias foreign policy.', 349, 699, ARRAY['https://images.unsplash.com/photo-1529101091760-61df52868615?auto=format&fit=crop&w=600'], 'https://example.com/demo.pdf', true, '6.7K+'),
    ('COA - Computer Architecture', 'Engineering', 'General', 'Introduction to Computer Organization and Architecture.', 49, 99, ARRAY['https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600'], 'https://example.com/demo.pdf', true, '7.8K+');
  end if;

  if not exists (select 1 from public.settings limit 1) then
    insert into public.settings (id, razorpay_key, enable_razorpay, enable_paypal) values (1, 'rzp_test_placeholder', true, false);
  end if;
end
$$;
