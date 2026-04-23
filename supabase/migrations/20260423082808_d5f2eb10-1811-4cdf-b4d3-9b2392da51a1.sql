alter table public.member_documents
add column if not exists storage_path text;

update public.member_documents
set storage_path = regexp_replace(file_url, '^.*/object/public/documents/', '')
where storage_path is null
  and file_url is not null
  and file_url like '%/object/public/documents/%';

update public.member_documents
set storage_path = regexp_replace(file_url, '^.*/object/sign/documents/', '')
where storage_path is null
  and file_url is not null
  and file_url like '%/object/sign/documents/%';

create or replace function public.resolve_member_document_url(p_document_id uuid, p_expires_in integer default 3600)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.member_documents%rowtype;
  v_signed_path text;
  v_token text;
begin
  select * into v_doc
  from public.member_documents
  where id = p_document_id;

  if not found then
    return null;
  end if;

  if not public.can_manage_member_lifecycle(auth.uid(), v_doc.member_id)
     and not exists (
       select 1
       from public.members m
       where m.id = v_doc.member_id
         and m.user_id = auth.uid()
     ) then
    raise exception 'Not authorized to access this document';
  end if;

  if v_doc.storage_path is null or btrim(v_doc.storage_path) = '' then
    return v_doc.file_url;
  end if;

  select signed_path, token
  into v_signed_path, v_token
  from storage.create_signed_url('documents', v_doc.storage_path, p_expires_in);

  if v_signed_path is null or v_token is null then
    return v_doc.file_url;
  end if;

  return '/storage/v1/object/sign/documents/' || v_signed_path || '?token=' || v_token;
end;
$$;