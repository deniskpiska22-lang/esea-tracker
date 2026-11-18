-- Regions follow nationality using src/utils/rankingCountries.js country groups.
create or replace function public.get_player_leaderboard(
  p_division text default null, p_region text default null,
  p_min_matches integer default 5, p_search text default ''
) returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with candidates as (
    select r.*, coalesce(nullif(p.nickname,''),r.nickname) public_nickname,
      p.country, p.faceit_elo, c.team_id, c.team,
      case upper(btrim(p.country))
        when 'AD' then 'Europe' when 'AL' then 'Europe' when 'AT' then 'Europe' when 'AX' then 'Europe' when 'BA' then 'Europe' when 'BE' then 'Europe' when 'BG' then 'Europe' when 'BY' then 'Europe' when 'CH' then 'Europe' when 'CY' then 'Europe' when 'CZ' then 'Europe' when 'DE' then 'Europe' when 'DK' then 'Europe' when 'EE' then 'Europe' when 'ES' then 'Europe' when 'FI' then 'Europe' when 'FO' then 'Europe' when 'FR' then 'Europe' when 'GB' then 'Europe' when 'GE' then 'Europe' when 'GG' then 'Europe' when 'GI' then 'Europe' when 'GR' then 'Europe' when 'HR' then 'Europe' when 'HU' then 'Europe' when 'IE' then 'Europe' when 'IM' then 'Europe' when 'IS' then 'Europe' when 'IT' then 'Europe' when 'JE' then 'Europe' when 'LI' then 'Europe' when 'LT' then 'Europe' when 'LU' then 'Europe' when 'LV' then 'Europe' when 'MC' then 'Europe' when 'MD' then 'Europe' when 'ME' then 'Europe' when 'MK' then 'Europe' when 'MT' then 'Europe' when 'NL' then 'Europe' when 'NO' then 'Europe' when 'PL' then 'Europe' when 'PT' then 'Europe' when 'RO' then 'Europe' when 'RS' then 'Europe' when 'RU' then 'Europe' when 'SE' then 'Europe' when 'SI' then 'Europe' when 'SJ' then 'Europe' when 'SK' then 'Europe' when 'SM' then 'Europe' when 'TR' then 'Europe' when 'UA' then 'Europe' when 'VA' then 'Europe' when 'XK' then 'Europe' when 'EU' then 'Europe' when 'UK' then 'Europe'
        when 'AG' then 'North America' when 'AI' then 'North America' when 'AW' then 'North America' when 'BB' then 'North America' when 'BL' then 'North America' when 'BM' then 'North America' when 'BQ' then 'North America' when 'BS' then 'North America' when 'BZ' then 'North America' when 'CA' then 'North America' when 'CR' then 'North America' when 'CU' then 'North America' when 'CW' then 'North America' when 'DM' then 'North America' when 'DO' then 'North America' when 'GD' then 'North America' when 'GL' then 'North America' when 'GP' then 'North America' when 'GT' then 'North America' when 'HN' then 'North America' when 'HT' then 'North America' when 'JM' then 'North America' when 'KN' then 'North America' when 'KY' then 'North America' when 'LC' then 'North America' when 'MF' then 'North America' when 'MQ' then 'North America' when 'MS' then 'North America' when 'MX' then 'North America' when 'NI' then 'North America' when 'PA' then 'North America' when 'PM' then 'North America' when 'PR' then 'North America' when 'SV' then 'North America' when 'SX' then 'North America' when 'TC' then 'North America' when 'TT' then 'North America' when 'US' then 'North America' when 'VC' then 'North America' when 'VG' then 'North America' when 'VI' then 'North America'
        when 'AR' then 'South America' when 'BO' then 'South America' when 'BR' then 'South America' when 'BV' then 'South America' when 'CL' then 'South America' when 'CO' then 'South America' when 'EC' then 'South America' when 'FK' then 'South America' when 'GF' then 'South America' when 'GS' then 'South America' when 'GY' then 'South America' when 'PE' then 'South America' when 'PY' then 'South America' when 'SR' then 'South America' when 'UY' then 'South America' when 'VE' then 'South America'
        when 'AE' then 'Asia' when 'AF' then 'Asia' when 'AM' then 'Asia' when 'AZ' then 'Asia' when 'BD' then 'Asia' when 'BH' then 'Asia' when 'BN' then 'Asia' when 'BT' then 'Asia' when 'CN' then 'Asia' when 'HK' then 'Asia' when 'ID' then 'Asia' when 'IL' then 'Asia' when 'IN' then 'Asia' when 'IQ' then 'Asia' when 'IR' then 'Asia' when 'JO' then 'Asia' when 'JP' then 'Asia' when 'KG' then 'Asia' when 'KH' then 'Asia' when 'KP' then 'Asia' when 'KR' then 'Asia' when 'KW' then 'Asia' when 'KZ' then 'Asia' when 'LA' then 'Asia' when 'LB' then 'Asia' when 'LK' then 'Asia' when 'MM' then 'Asia' when 'MN' then 'Asia' when 'MO' then 'Asia' when 'MV' then 'Asia' when 'MY' then 'Asia' when 'NP' then 'Asia' when 'OM' then 'Asia' when 'PH' then 'Asia' when 'PK' then 'Asia' when 'PS' then 'Asia' when 'QA' then 'Asia' when 'SA' then 'Asia' when 'SG' then 'Asia' when 'SY' then 'Asia' when 'TH' then 'Asia' when 'TJ' then 'Asia' when 'TL' then 'Asia' when 'TM' then 'Asia' when 'TW' then 'Asia' when 'UZ' then 'Asia' when 'VN' then 'Asia' when 'YE' then 'Asia'
        when 'AS' then 'Oceania' when 'AU' then 'Oceania' when 'CC' then 'Oceania' when 'CK' then 'Oceania' when 'CX' then 'Oceania' when 'FJ' then 'Oceania' when 'FM' then 'Oceania' when 'GU' then 'Oceania' when 'HM' then 'Oceania' when 'KI' then 'Oceania' when 'MH' then 'Oceania' when 'MP' then 'Oceania' when 'NC' then 'Oceania' when 'NF' then 'Oceania' when 'NR' then 'Oceania' when 'NU' then 'Oceania' when 'NZ' then 'Oceania' when 'PF' then 'Oceania' when 'PG' then 'Oceania' when 'PN' then 'Oceania' when 'PW' then 'Oceania' when 'SB' then 'Oceania' when 'TK' then 'Oceania' when 'TO' then 'Oceania' when 'TV' then 'Oceania' when 'UM' then 'Oceania' when 'VU' then 'Oceania' when 'WF' then 'Oceania' when 'WS' then 'Oceania'
        when 'AO' then 'Africa' when 'BF' then 'Africa' when 'BI' then 'Africa' when 'BJ' then 'Africa' when 'BW' then 'Africa' when 'CD' then 'Africa' when 'CF' then 'Africa' when 'CG' then 'Africa' when 'CI' then 'Africa' when 'CM' then 'Africa' when 'CV' then 'Africa' when 'DJ' then 'Africa' when 'DZ' then 'Africa' when 'EG' then 'Africa' when 'EH' then 'Africa' when 'ER' then 'Africa' when 'ET' then 'Africa' when 'GA' then 'Africa' when 'GH' then 'Africa' when 'GM' then 'Africa' when 'GN' then 'Africa' when 'GQ' then 'Africa' when 'GW' then 'Africa' when 'IO' then 'Africa' when 'KE' then 'Africa' when 'KM' then 'Africa' when 'LR' then 'Africa' when 'LS' then 'Africa' when 'LY' then 'Africa' when 'MA' then 'Africa' when 'MG' then 'Africa' when 'ML' then 'Africa' when 'MR' then 'Africa' when 'MU' then 'Africa' when 'MW' then 'Africa' when 'MZ' then 'Africa' when 'NA' then 'Africa' when 'NE' then 'Africa' when 'NG' then 'Africa' when 'RE' then 'Africa' when 'RW' then 'Africa' when 'SC' then 'Africa' when 'SD' then 'Africa' when 'SH' then 'Africa' when 'SL' then 'Africa' when 'SN' then 'Africa' when 'SO' then 'Africa' when 'SS' then 'Africa' when 'ST' then 'Africa' when 'SZ' then 'Africa' when 'TD' then 'Africa' when 'TF' then 'Africa' when 'TG' then 'Africa' when 'TN' then 'Africa' when 'TZ' then 'Africa' when 'UG' then 'Africa' when 'YT' then 'Africa' when 'ZA' then 'Africa' when 'ZM' then 'Africa' when 'ZW' then 'Africa'
        else null end player_region
    from public.player_ratings r
    left join public.players p on p.faceit_id=r.player_id
    left join lateral (
      select tc.team_id,tc.team from public.team_players tp
      join public.team_catalog tc on tc.team_id=tp.team_id
      where tp.player_id=p.id and tp.is_active=true
      order by tp.joined_at desc nulls last,tp.id limit 1
    ) c on true
    where r.rating > 0 and r.rating < 100
      and r.matches_played >= least(greatest(coalesce(p_min_matches,5),5),100)
  ), filtered as (
    select * from candidates
    where (nullif(p_division,'') is null or team->>'division'=p_division)
      and (nullif(p_region,'') is null or player_region=p_region)
  ), ranked as (
    select *, row_number() over(order by rating desc,matches_played desc,player_id) position from filtered
  )
  select jsonb_build_object(
    'player_id',player_id,'nickname',public_nickname,'country',country,
    'rating',rating,'recent_rating',recent_rating,'matches_played',matches_played,'maps_played',maps_played,
    'adr',adr,'kd',kd,'faceit_elo',faceit_elo,'updated_at',updated_at,'position',position,
    'team_id',team_id,'team_name',team->>'name','team_slug',team->>'slug','team_logo',team->>'logo',
    'division',team->>'division','region',player_region
  ) from ranked
  where (nullif(btrim(p_search),'') is null
    or strpos(lower(public_nickname),lower(left(btrim(p_search),80)))>0)
  order by rating desc,matches_played desc,player_id limit 100;
$$;
revoke all on function public.get_player_leaderboard(text,text,integer,text) from public;
grant execute on function public.get_player_leaderboard(text,text,integer,text) to anon,authenticated,service_role;
