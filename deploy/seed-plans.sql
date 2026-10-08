--
-- PostgreSQL database dump
--

\restrict 2YuJrATcPHpehjPi4AAniCGzPtdQHC4LsRCp2iD76v3fOQ7ej0yMNQewZtOKQ2k

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: training_plans; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.training_plans (id, name, slug, description, image_key, created_at, watermark_key) VALUES (1, 'Spartan Plan', 'spartan', 'High-intensity conditioning and functional strength training.', 'spartan.jpg', '2026-08-06 14:35:13.746639+05:30', 'spartan_watermark.avif') ON CONFLICT DO NOTHING;
INSERT INTO public.training_plans (id, name, slug, description, image_key, created_at, watermark_key) VALUES (2, 'Greek God Plan', 'greek-god', 'Aesthetic muscle building focused on shoulder-to-waist ratio and proportion.', 'greek_god.png', '2026-08-06 14:35:13.746639+05:30', 'greek_god_watermark.jpg') ON CONFLICT DO NOTHING;
INSERT INTO public.training_plans (id, name, slug, description, image_key, created_at, watermark_key) VALUES (3, 'Superhero Plan', 'superhero', 'Heavy compound lifting for mass, power, and overall explosive strength.', 'superhero.jpg', '2026-08-06 14:35:13.746639+05:30', 'superhero_watermark.jpg') ON CONFLICT DO NOTHING;
INSERT INTO public.training_plans (id, name, slug, description, image_key, created_at, watermark_key) VALUES (4, 'Athlete Plan', 'athlete', 'Agility, speed, dynamic movement, and functional athletic performance.', 'athlete.jpg', '2026-08-06 14:35:13.746639+05:30', 'athlete_watermark.jpg') ON CONFLICT DO NOTHING;
INSERT INTO public.training_plans (id, name, slug, description, image_key, created_at, watermark_key) VALUES (5, 'Manga Plan', 'manga', 'Anime-inspired aesthetic training: lean physique, high volume, visible definition.', 'manga.jpg', '2026-08-06 14:35:13.746639+05:30', 'manga_watermark.jpg') ON CONFLICT DO NOTHING;


--
-- Data for Name: nutrition_templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.nutrition_templates (id, training_plan_id, calorie_guidance, protein_pct, carbs_pct, fats_pct, meal_frequency, notes) VALUES (1, 1, 'Maintenance to slight deficit, ~15% below TDEE', 35, 40, 25, 4, 'Prioritize lean protein and complex carbs around training.') ON CONFLICT DO NOTHING;


--
-- Data for Name: workout_templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.workout_templates (id, training_plan_id, split_name, day_order, notes) VALUES (1, 1, 'Conditioning + Lower Body', 1, 'Kettlebell + sled work') ON CONFLICT DO NOTHING;
INSERT INTO public.workout_templates (id, training_plan_id, split_name, day_order, notes) VALUES (2, 1, 'Upper Body Strength', 2, 'Compound pressing and pulling') ON CONFLICT DO NOTHING;


--
-- Data for Name: workout_exercises; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.workout_exercises (id, workout_template_id, name, sets, reps, rest_seconds, exercise_order) VALUES (1, 1, 'Kettlebell Swing', 4, '15-20', 45, 1) ON CONFLICT DO NOTHING;
INSERT INTO public.workout_exercises (id, workout_template_id, name, sets, reps, rest_seconds, exercise_order) VALUES (2, 1, 'Sled Push', 5, '20m', 60, 2) ON CONFLICT DO NOTHING;
INSERT INTO public.workout_exercises (id, workout_template_id, name, sets, reps, rest_seconds, exercise_order) VALUES (3, 2, 'Barbell Bench Press', 4, '6-8', 90, 1) ON CONFLICT DO NOTHING;


--
-- Name: nutrition_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nutrition_templates_id_seq', 1, true);


--
-- Name: training_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.training_plans_id_seq', 10, true);


--
-- Name: workout_exercises_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.workout_exercises_id_seq', 3, true);


--
-- Name: workout_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.workout_templates_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict 2YuJrATcPHpehjPi4AAniCGzPtdQHC4LsRCp2iD76v3fOQ7ej0yMNQewZtOKQ2k

