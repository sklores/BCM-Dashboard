alter table messages
  add column tags text[] not null default '{}';

create index messages_tags_gin_idx on messages using gin (tags);
