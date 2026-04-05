-- Migration: add icon and color to buttons table
alter table buttons
  add column if not exists icon  text not null default 'notifications',
  add column if not exists color text not null default 'indigo';
