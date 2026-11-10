-- Ratings are now whole numbers (1-10, no decimals).
ALTER TABLE public.player_ratings
  ADD CONSTRAINT player_ratings_rating_whole
  CHECK (rating = ROUND(rating));

ALTER TABLE public.match_participants
  ADD CONSTRAINT match_participants_combined_rating_whole
  CHECK (combined_rating IS NULL OR combined_rating = ROUND(combined_rating));