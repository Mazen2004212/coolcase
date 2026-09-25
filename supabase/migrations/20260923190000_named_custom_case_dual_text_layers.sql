-- Add independent English and Arabic text layers to named custom-case templates.
-- Legacy single-layer columns remain intact for historical compatibility.

alter table public.custom_case_templates
  add column english_max_characters integer not null default 18,
  add column english_font_key text not null default 'INTER',
  add column english_font_size integer not null default 38,
  add column english_font_weight integer not null default 600,
  add column english_text_color text not null default '#111111',
  add column english_text_x numeric(5,2) not null default 50,
  add column english_text_y numeric(5,2) not null default 44,
  add column english_text_rotation numeric(5,2) not null default 0,
  add column english_text_align text not null default 'center',
  add column english_text_transform text not null default 'UPPERCASE',
  add column arabic_max_characters integer not null default 18,
  add column arabic_font_key text not null default 'TAHOMA',
  add column arabic_font_size integer not null default 38,
  add column arabic_font_weight integer not null default 600,
  add column arabic_text_color text not null default '#111111',
  add column arabic_text_x numeric(5,2) not null default 50,
  add column arabic_text_y numeric(5,2) not null default 56,
  add column arabic_text_rotation numeric(5,2) not null default 0,
  add column arabic_text_align text not null default 'center';

alter table public.custom_case_templates
  add constraint custom_case_templates_english_max_chars check (english_max_characters between 1 and 40),
  add constraint custom_case_templates_english_font check (english_font_key in ('INTER','GEORGIA','ARIAL','TAHOMA')),
  add constraint custom_case_templates_english_font_size check (english_font_size between 10 and 96),
  add constraint custom_case_templates_english_font_weight check (english_font_weight between 300 and 900 and english_font_weight % 100 = 0),
  add constraint custom_case_templates_english_color check (english_text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint custom_case_templates_english_position check (english_text_x between 0 and 100 and english_text_y between 0 and 100),
  add constraint custom_case_templates_english_rotation check (english_text_rotation between -45 and 45),
  add constraint custom_case_templates_english_align check (english_text_align in ('left','center','right')),
  add constraint custom_case_templates_english_transform check (english_text_transform in ('NONE','UPPERCASE','LOWERCASE')),
  add constraint custom_case_templates_arabic_max_chars check (arabic_max_characters between 1 and 40),
  add constraint custom_case_templates_arabic_layer_font check (arabic_font_key in ('ARIAL','TAHOMA')),
  add constraint custom_case_templates_arabic_font_size check (arabic_font_size between 10 and 96),
  add constraint custom_case_templates_arabic_font_weight check (arabic_font_weight between 300 and 900 and arabic_font_weight % 100 = 0),
  add constraint custom_case_templates_arabic_color check (arabic_text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint custom_case_templates_arabic_position check (arabic_text_x between 0 and 100 and arabic_text_y between 0 and 100),
  add constraint custom_case_templates_arabic_rotation check (arabic_text_rotation between -45 and 45),
  add constraint custom_case_templates_arabic_align check (arabic_text_align in ('left','center','right'));

create or replace function private.validate_named_custom_case_order_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_active boolean;
  v_dual_layer boolean;
begin
  if new.customization_type is distinct from 'NAMED_TEMPLATE' then
    return new;
  end if;

  select template.is_active into v_active
  from public.custom_case_templates as template
  where template.id = new.custom_template_id
  for key share;

  if not found or not v_active then
    raise exception using errcode = '23514', message = 'Named custom case template is no longer active';
  end if;

  if new.customization_snapshot ->> 'templateId' is distinct from new.custom_template_id::text then
    raise exception using errcode = '23514', message = 'Named custom case snapshot template does not match its reference';
  end if;

  v_dual_layer := new.customization_snapshot ? 'englishName'
    or new.customization_snapshot ? 'arabicName'
    or new.customization_snapshot ? 'englishStyle'
    or new.customization_snapshot ? 'arabicStyle';

  if v_dual_layer then
    if length(btrim(coalesce(new.customization_snapshot ->> 'englishName', ''))) = 0
      or length(btrim(coalesce(new.customization_snapshot ->> 'arabicName', ''))) = 0
      or length(btrim(coalesce(new.customization_snapshot ->> 'englishRenderedText', ''))) = 0
      or length(btrim(coalesce(new.customization_snapshot ->> 'arabicRenderedText', ''))) = 0
      or jsonb_typeof(new.customization_snapshot -> 'englishStyle') is distinct from 'object'
      or jsonb_typeof(new.customization_snapshot -> 'arabicStyle') is distinct from 'object'
    then
      raise exception using errcode = '23514', message = 'Named custom case snapshot requires both text layers';
    end if;
  elsif length(btrim(coalesce(new.customization_snapshot ->> 'renderedText', ''))) = 0 then
    raise exception using errcode = '23514', message = 'Legacy named custom case snapshot requires rendered text';
  end if;

  return new;
end;
$$;
