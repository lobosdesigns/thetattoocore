alter type public.ad_campaign_type add value if not exists 'merch_listing';
alter type public.ad_campaign_goal add value if not exists 'product_views';
alter type public.ad_campaign_goal add value if not exists 'shop_visits';
alter type public.ad_campaign_goal add value if not exists 'purchases';
alter type public.ad_placement add value if not exists 'merch';
