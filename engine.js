// TOK suggestion engine — looks up the currently playing track in a small
// hand-curated DJ database (bpm/key/energy + "speed up / stay / slow down"
// suggestions) and resolves those suggestions against whatever tracks are
// actually present in the loaded YouTube playlist.
(function(){
  const DB_KEY = 'tok_database';

  const DEFAULT_DATABASE = [
    { "id": "george_benson_the_world_is_a_ghetto", "title": "The World Is a Ghetto", "artist": "George Benson", "bpm": 85, "key": "5A", "energy": 2, "tags": ["jazz-funk", "soul", "classic", "organic"], "suggestions": { "speed_up": ["thievery_corporation_music_to_make_you_stagger", "gotts_street_park_tell_me_why"], "stay": ["loyle_carner_aint_nothing_changed", "thandii_give_me_a_smile"], "slow_down": ["air_la_femme_dargent"] } },
    { "id": "supershy_moment_by_moment", "title": "Moment By Moment", "artist": "Supershy, Jordan Rakei, Tom Misch", "bpm": 124, "key": "11A", "energy": 4, "tags": ["house", "disco", "groove", "modern"], "suggestions": { "speed_up": ["armand_van_helden_you_dont_know_me", "barry_cant_swim_still_riding"], "stay": ["barry_cant_swim_god_is_the_space_between_us", "dutchican_soul_be_funky"], "slow_down": ["bonobo_rosewood", "jungle_beat_54_all_good_now"] } },
    { "id": "barry_cant_swim_god_is_the_space_between_us", "title": "God Is The Space Between Us", "artist": "Barry Can't Swim, Taite Imogen", "bpm": 124, "key": "8A", "energy": 4, "tags": ["house", "electronic", "melodic", "piano"], "suggestions": { "speed_up": ["shir_t_hackney_birdwatch", "bonobo_defender"], "stay": ["supershy_moment_by_moment", "dutchican_soul_be_funky"], "slow_down": ["barry_cant_swim_sunsleeper", "fred_again_places_to_be"] } },
    { "id": "benny_sings_big_brown_eyes", "title": "Big Brown Eyes", "artist": "Benny Sings", "bpm": 96, "key": "7B", "energy": 2, "tags": ["indie-pop", "yacht-rock", "sunny", "chill"], "suggestions": { "speed_up": ["jamiroquai_virtual_insanity", "khruangbin_mr_white"], "stay": ["thandii_give_me_a_smile", "greentea_peng_stuck_in_the_middle"], "slow_down": ["bonobo_days_to_come", "george_benson_the_world_is_a_ghetto"] } },
    { "id": "star_slinger_truth", "title": "Truth", "artist": "Star Slinger", "bpm": 120, "key": "5A", "energy": 3, "tags": ["electronic", "beat", "sample", "house"], "suggestions": { "speed_up": ["bonobo_rosewood", "dan_kye_focus"], "stay": ["jungle_talk_about_it", "parcels_lightenup_remix"], "slow_down": ["jungle_beat_54_all_good_now", "maribou_state_midas"] } },
    { "id": "my_baby_smiley_virus", "title": "Smiley Virus", "artist": "MY BABY", "bpm": 128, "key": "10A", "energy": 5, "tags": ["psychedelic", "rock", "trance", "organic", "heavy"], "suggestions": { "speed_up": ["gerry_read_shit_cant_make_anything", "king_booo_tunes_since_89"], "stay": ["barry_cant_swim_still_riding", "fred_again_baxter"], "slow_down": ["bonobo_defender", "daft_punk_revolution_909"] } },
    { "id": "thandii_give_me_a_smile", "title": "Give Me A Smile", "artist": "Thandii", "bpm": 90, "key": "11A", "energy": 2, "tags": ["indie", "soul", "lo-fi", "chill"], "suggestions": { "speed_up": ["benny_sings_big_brown_eyes", "jamiroquai_virtual_insanity"], "stay": ["gotts_street_park_tell_me_why", "bonobo_days_to_come"], "slow_down": ["stavroz_in_mindibu", "george_benson_the_world_is_a_ghetto"] } },
    { "id": "arc_de_soleil_the_thief_in_marrakesh", "title": "The Thief in Marrakesh", "artist": "Arc De Soleil", "bpm": 105, "key": "4A", "energy": 3, "tags": ["surf-rock", "retro", "groove", "instrumental"], "suggestions": { "speed_up": ["pigeon_miami", "daft_punk_voyager"], "stay": ["khruangbin_mr_white", "fat_freddys_drop_wandering_eye"], "slow_down": ["jamiroquai_virtual_insanity", "benny_sings_big_brown_eyes"] } },
    { "id": "fred_again_places_to_be", "title": "places to be", "artist": "Fred again.., Anderson .Paak, CHIKA", "bpm": 122, "key": "1A", "energy": 4, "tags": ["electronic", "uk-garage", "hip-hop", "energetic"], "suggestions": { "speed_up": ["barry_cant_swim_god_is_the_space_between_us", "supershy_moment_by_moment"], "stay": ["bonobo_rosewood", "barry_cant_swim_sunsleeper"], "slow_down": ["jungle_talk_about_it", "dan_kye_focus"] } },
    { "id": "jaded_carlita_zorro", "title": "Zorro", "artist": "JADED, Carlita", "bpm": 126, "key": "5A", "energy": 4, "tags": ["house", "tech-house", "latin", "club"], "suggestions": { "speed_up": ["barry_cant_swim_still_riding", "my_baby_smiley_virus"], "stay": ["daft_punk_revolution_909", "folamour_these_are_just_places_to_me_now"], "slow_down": ["supershy_moment_by_moment", "barry_cant_swim_sunsleeper"] } },
    { "id": "flight_facilities_down_to_earth", "title": "Down To Earth", "artist": "Flight Facilities", "bpm": 126, "key": "7A", "energy": 3, "tags": ["indie-dance", "nu-disco", "smooth"], "suggestions": { "speed_up": ["crystal_waters_gypsy_woman", "shir_t_hackney_birdwatch"], "stay": ["folamour_these_are_just_places_to_me_now", "ezra_collective_god_gave_me_feet"], "slow_down": ["barry_cant_swim_can_we_still_be_friends", "bonobo_rosewood"] } },
    { "id": "gerry_read_shit_cant_make_anything", "title": "Shit Cant Make Anything", "artist": "Gerry Read", "bpm": 130, "key": "1A", "energy": 5, "tags": ["house", "lo-fi", "quirky", "raw"], "suggestions": { "speed_up": ["king_booo_tunes_since_89", "the_smile_zero_sum"], "stay": ["lemtom_namerakana", "my_baby_smiley_virus"], "slow_down": ["barry_cant_swim_still_riding", "fred_again_baxter"] } },
    { "id": "thievery_corporation_music_to_make_you_stagger", "title": "Music To Make You Stagger", "artist": "Thievery Corporation", "bpm": 78, "key": "11A", "energy": 2, "tags": ["downtempo", "dub", "trip-hop", "smoky"], "suggestions": { "speed_up": ["george_benson_the_world_is_a_ghetto", "loyle_carner_aint_nothing_changed"], "stay": ["air_la_femme_dargent", "stavroz_in_mindibu"], "slow_down": ["air_la_femme_dargent"] } },
    { "id": "maribou_state_kingdom", "title": "Kingdom", "artist": "Maribou State, North Downs", "bpm": 107, "key": "10A", "energy": 3, "tags": ["electronic", "indie", "organic", "sunset"], "suggestions": { "speed_up": ["daft_punk_voyager", "gorillaz_andromeda"], "stay": ["pigeon_miami", "fat_freddys_drop_wandering_eye"], "slow_down": ["arc_de_soleil_the_thief_in_marrakesh", "khruangbin_mr_white"] } },
    { "id": "shir_t_hackney_birdwatch", "title": "Hackney Birdwatch (Mixed)", "artist": "Shire T", "bpm": 126, "key": "9A", "energy": 4, "tags": ["house", "uk-garage", "breakbeat"], "suggestions": { "speed_up": ["bonobo_receiver", "barry_cant_swim_still_riding"], "stay": ["daft_punk_revolution_909", "jaded_carlita_zorro"], "slow_down": ["barry_cant_swim_god_is_the_space_between_us", "fred_again_places_to_be"] } },
    { "id": "folamour_these_are_just_places_to_me_now", "title": "These Are Just Places To Me Now", "artist": "Folamour", "bpm": 126, "key": "8A", "energy": 3, "tags": ["deep-house", "jazz-house", "soulful", "warm"], "suggestions": { "speed_up": ["crystal_waters_gypsy_woman", "jaded_carlita_zorro"], "stay": ["flight_facilities_down_to_earth", "ezra_collective_god_gave_me_feet"], "slow_down": ["barry_cant_swim_can_we_still_be_friends", "moods_all_for_you"] } },
    { "id": "jungle_beat_54_all_good_now", "title": "Beat 54 (All Good Now)", "artist": "Jungle", "bpm": 118, "key": "7A", "energy": 3, "tags": ["neo-soul", "funk", "groove", "sunny"], "suggestions": { "speed_up": ["star_slinger_truth", "parcels_lightenup_remix"], "stay": ["jungle_talk_about_it", "asl_caius_let_it_go_baby"], "slow_down": ["maribou_state_midas", "maribou_state_tongue"] } },
    { "id": "maribou_state_midas", "title": "Midas", "artist": "Maribou State, Holly Walker", "bpm": 115, "key": "11A", "energy": 3, "tags": ["electronic", "indie-soul", "smooth", "vocal"], "suggestions": { "speed_up": ["jungle_beat_54_all_good_now", "asl_caius_let_it_go_baby"], "stay": ["maribou_state_tongue", "dam_swindle_yes_no_maybe"], "slow_down": ["gorillaz_andromeda", "moods_all_for_you"] } },
    { "id": "dam_swindle_yes_no_maybe", "title": "Yes, No, Maybe", "artist": "Dam Swindle", "bpm": 114, "key": "5A", "energy": 3, "tags": ["house", "deep-house", "funky", "groove"], "suggestions": { "speed_up": ["maribou_state_midas", "jungle_beat_54_all_good_now"], "stay": ["moods_all_for_you", "young_franco_rollout"], "slow_down": ["gorillaz_andromeda", "getdown_services_the_radiator"] } },
    { "id": "gotts_street_park_tell_me_why", "title": "Tell Me Why", "artist": "Gotts Street Park, Olive Jones", "bpm": 89, "key": "4A", "energy": 2, "tags": ["vintage-soul", "downtempo", "smoky", "raw"], "suggestions": { "speed_up": ["thandii_give_me_a_smile", "benny_sings_big_brown_eyes"], "stay": ["bonobo_days_to_come", "george_benson_the_world_is_a_ghetto"], "slow_down": ["thievery_corporation_music_to_make_you_stagger", "air_la_femme_dargent"] } },
    { "id": "air_la_femme_dargent", "title": "La femme d'argent", "artist": "Air", "bpm": 74, "key": "5A", "energy": 2, "tags": ["space-rock", "downtempo", "classic", "ambient-pop"], "suggestions": { "speed_up": ["thievery_corporation_music_to_make_you_stagger", "loyle_carner_aint_nothing_changed"], "stay": ["stavroz_in_mindibu", "thievery_corporation_music_to_make_you_stagger"], "slow_down": ["air_la_femme_dargent"] } },
    { "id": "barry_cant_swim_still_riding", "title": "Still Riding", "artist": "Barry Can't Swim", "bpm": 128, "key": "9A", "energy": 4, "tags": ["house", "electronic", "club", "uplifting"], "suggestions": { "speed_up": ["my_baby_smiley_virus", "gerry_read_shit_cant_make_anything"], "stay": ["bonobo_defender", "fred_again_baxter"], "slow_down": ["daft_punk_revolution_909", "jaded_carlita_zorro"] } },
    { "id": "ezra_collective_god_gave_me_feet", "title": "God Gave Me Feet For Dancing", "artist": "Ezra Collective, Yazmin Lacey", "bpm": 126, "key": "9A", "energy": 4, "tags": ["afro-jazz", "dance", "organic", "brass"], "suggestions": { "speed_up": ["barry_cant_swim_still_riding", "bonobo_defender"], "stay": ["folamour_these_are_just_places_to_me_now", "flight_facilities_down_to_earth"], "slow_down": ["supershy_moment_by_moment", "barry_cant_swim_can_we_still_be_friends"] } },
    { "id": "barry_cant_swim_sunsleeper", "title": "Sunsleeper", "artist": "Barry Can't Swim", "bpm": 123, "key": "4A", "energy": 4, "tags": ["house", "bright", "sunny", "electronic"], "suggestions": { "speed_up": ["supershy_moment_by_moment", "barry_cant_swim_god_is_the_space_between_us"], "stay": ["fred_again_places_to_be", "bonobo_rosewood"], "slow_down": ["dan_kye_focus", "star_slinger_truth"] } },
    { "id": "barry_cant_swim_can_we_still_be_friends", "title": "Can We Still Be Friends?", "artist": "Barry Can't Swim, Laurence Guy", "bpm": 124, "key": "7A", "energy": 3, "tags": ["house", "deep-house", "melodic", "warm"], "suggestions": { "speed_up": ["barry_cant_swim_god_is_the_space_between_us", "dutchican_soul_be_funky"], "stay": ["supershy_moment_by_moment", "flight_facilities_down_to_earth"], "slow_down": ["bonobo_rosewood", "dan_kye_focus"] } },
    { "id": "asl_caius_let_it_go_baby", "title": "Let It Go, Baby", "artist": "A/S/L, Caius", "bpm": 118, "key": "6A", "energy": 3, "tags": ["house", "french-touch", "filter-house"], "suggestions": { "speed_up": ["star_slinger_truth", "dan_kye_focus"], "stay": ["jungle_beat_54_all_good_now", "ezra_collective_no_ones_watching_me"], "slow_down": ["maribou_state_midas", "maribou_state_tongue"] } },
    { "id": "moods_all_for_you", "title": "All for You", "artist": "Moods, Wayne Snow", "bpm": 114, "key": "2A", "energy": 3, "tags": ["future-soul", "electronic", "smooth", "rnb"], "suggestions": { "speed_up": ["maribou_state_midas", "jungle_beat_54_all_good_now"], "stay": ["dam_swindle_yes_no_maybe", "young_franco_rollout"], "slow_down": ["gorillaz_andromeda", "getdown_services_the_radiator"] } },
    { "id": "dutchican_soul_be_funky", "title": "Be Funky (Dutchican Soul Remix)", "artist": "Dutchican Soul, Yogi", "bpm": 124, "key": "6A", "energy": 4, "tags": ["house", "jackin-house", "funky", "piano"], "suggestions": { "speed_up": ["crystal_waters_gypsy_woman", "armand_van_helden_you_dont_know_me"], "stay": ["supershy_moment_by_moment", "barry_cant_swim_god_is_the_space_between_us"], "slow_down": ["barry_cant_swim_can_we_still_be_friends", "bonobo_rosewood"] } },
    { "id": "ezra_collective_no_ones_watching_me", "title": "No One's Watching Me", "artist": "Ezra Collective, Olivia Dean", "bpm": 118, "key": "12B", "energy": 3, "tags": ["jazz", "soul", "warm", "vocal"], "suggestions": { "speed_up": ["parcels_lightenup_remix", "star_slinger_truth"], "stay": ["jungle_beat_54_all_good_now", "asl_caius_let_it_go_baby"], "slow_down": ["maribou_state_midas", "getdown_services_the_radiator"] } },
    { "id": "young_franco_rollout", "title": "Rollout", "artist": "Young Franco, Jay Prince, Scrufizzer, Close Counters", "bpm": 114, "key": "11A", "energy": 3, "tags": ["hip-house", "funky", "groove", "rap"], "suggestions": { "speed_up": ["jungle_beat_54_all_good_now", "star_slinger_truth"], "stay": ["dam_swindle_yes_no_maybe", "moods_all_for_you"], "slow_down": ["gorillaz_andromeda", "getdown_services_the_radiator"] } },
    { "id": "close_counters_visions_remix", "title": "VISIONS (Moses Carr Remix)", "artist": "Close Counters, Moses Carr", "bpm": 126, "key": "4A", "energy": 4, "tags": ["broken-beat", "house", "future-jazz", "synths"], "suggestions": { "speed_up": ["barry_cant_swim_still_riding", "bonobo_defender"], "stay": ["shir_t_hackney_birdwatch", "jaded_carlita_zorro"], "slow_down": ["barry_cant_swim_sunsleeper", "fred_again_places_to_be"] } },
    { "id": "gorillaz_andromeda", "title": "Andromeda", "artist": "Gorillaz, DRAM", "bpm": 114, "key": "3A", "energy": 3, "tags": ["synth-pop", "dance-pop", "cosmic", "smooth"], "suggestions": { "speed_up": ["moods_all_for_you", "maribou_state_midas"], "stay": ["getdown_services_the_radiator", "daft_punk_voyager"], "slow_down": ["pigeon_miami", "maribou_state_kingdom"] } },
    { "id": "my_baby_sunroof_diesel_blues", "title": "Sunroof Diesel Blues", "artist": "MY BABY", "bpm": 102, "key": "7A", "energy": 3, "tags": ["blues-rock", "psychedelic", "swampy", "organic"], "suggestions": { "speed_up": ["arc_de_soleil_the_thief_in_marrakesh", "maribou_state_kingdom"], "stay": ["khruangbin_mr_white", "fat_freddys_drop_wandering_eye"], "slow_down": ["jamiroquai_virtual_insanity", "benny_sings_big_brown_eyes"] } },
    { "id": "parcels_lightenup_remix", "title": "Lightenup (Alex Metric Remix)", "artist": "Parcels, Alex Metric", "bpm": 120, "key": "8A", "energy": 4, "tags": ["nu-disco", "indie-dance", "pumping"], "suggestions": { "speed_up": ["supershy_moment_by_moment", "barry_cant_swim_sunsleeper"], "stay": ["star_slinger_truth", "dan_kye_focus"], "slow_down": ["jungle_talk_about_it", "jungle_beat_54_all_good_now"] } },
    { "id": "loyle_carner_aint_nothing_changed", "title": "Ain't Nothing Changed", "artist": "Loyle Carner", "bpm": 83, "key": "5A", "energy": 2, "tags": ["hip-hop", "jazz-hop", "chill", "uk-rap"], "suggestions": { "speed_up": ["george_benson_the_world_is_a_ghetto", "gotts_street_park_tell_me_why"], "stay": ["thievery_corporation_music_to_make_you_stagger", "stavroz_in_mindibu"], "slow_down": ["air_la_femme_dargent"] } },
    { "id": "dan_kye_focus", "title": "Focus (SE Edit)", "artist": "Dan Kye", "bpm": 120, "key": "9A", "energy": 3, "tags": ["deep-house", "electronic", "groove", "soulful"], "suggestions": { "speed_up": ["bonobo_rosewood", "barry_cant_swim_sunsleeper"], "stay": ["star_slinger_truth", "parcels_lightenup_remix"], "slow_down": ["jungle_talk_about_it", "maribou_state_midas"] } },
    { "id": "fred_again_baxter", "title": "Baxter (these are my friends)", "artist": "Fred again.., Baxter Dury", "bpm": 128, "key": "11A", "energy": 4, "tags": ["electronic", "indie-dance", "spoken-word", "club"], "suggestions": { "speed_up": ["my_baby_smiley_virus", "gerry_read_shit_cant_make_anything"], "stay": ["barry_cant_swim_still_riding", "bonobo_defender"], "slow_down": ["daft_punk_revolution_909", "shir_t_hackney_birdwatch"] } },
    { "id": "king_booo_tunes_since_89", "title": "Tunes Since '89", "artist": "KING BOOO!", "bpm": 131, "key": "6A", "energy": 5, "tags": ["rave", "house", "breaks", "retro-future"], "suggestions": { "speed_up": ["the_smile_zero_sum"], "stay": ["gerry_read_shit_cant_make_anything", "lemtom_namerakana"], "slow_down": ["my_baby_smiley_virus", "barry_cant_swim_still_riding"] } },
    { "id": "avaion_wacuka", "title": "WACUKA", "artist": "AVAION, Sofiya Nzau", "bpm": 126, "key": "4A", "energy": 4, "tags": ["afro-house", "deep-house", "melodic", "hypnotic"], "suggestions": { "speed_up": ["bonobo_defender", "barry_cant_swim_still_riding"], "stay": ["rampa_les_gout", "jaded_carlita_zorro"], "slow_down": ["barry_cant_swim_god_is_the_space_between_us", "bonobo_rosewood"] } },
    { "id": "armand_van_helden_you_dont_know_me", "title": "You Don't Know Me (Radio Edit)", "artist": "Armand Van Helden, Duane Harden", "bpm": 126, "key": "1B", "energy": 4, "tags": ["house", "classic-house", "garage-house", "anthem"], "suggestions": { "speed_up": ["barry_cant_swim_still_riding", "my_baby_smiley_virus"], "stay": ["crystal_waters_gypsy_woman", "dutchican_soul_be_funky"], "slow_down": ["supershy_moment_by_moment", "flight_facilities_down_to_earth"] } },
    { "id": "bonobo_defender", "title": "Defender", "artist": "Bonobo", "bpm": 127, "key": "11A", "energy": 4, "tags": ["electronic", "house", "melodic", "lush"], "suggestions": { "speed_up": ["barry_cant_swim_still_riding", "my_baby_smiley_virus"], "stay": ["fred_again_baxter", "daft_punk_revolution_909"], "slow_down": ["bonobo_rosewood", "avaion_wacuka"] } },
    { "id": "house_gospel_choir_angels", "title": "Angels (Original Vocal Mix)", "artist": "House Gospel Choir, MORGAN", "bpm": 126, "key": "8A", "energy": 4, "tags": ["gospel-house", "soulful-house", "uplifting"], "suggestions": { "speed_up": ["armand_van_helden_you_dont_know_me", "bonobo_defender"], "stay": ["folamour_these_are_just_places_to_me_now", "dutchican_soul_be_funky"], "slow_down": ["barry_cant_swim_can_we_still_be_friends", "flight_facilities_down_to_earth"] } },
    { "id": "bonobo_rosewood", "title": "Rosewood", "artist": "Bonobo", "bpm": 122, "key": "8A", "energy": 3, "tags": ["electronic", "house", "organic-house", "warm"], "suggestions": { "speed_up": ["barry_cant_swim_sunsleeper", "supershy_moment_by_moment"], "stay": ["fred_again_places_to_be", "dan_kye_focus"], "slow_down": ["jungle_beat_54_all_good_now", "maribou_state_midas"] } },
    { "id": "bonobo_days_to_come", "title": "Days To Come", "artist": "Bonobo, Bajka", "bpm": 91, "key": "9A", "energy": 2, "tags": ["downtempo", "jazz", "trip-hop", "melancholic"], "suggestions": { "speed_up": ["benny_sings_big_brown_eyes", "jamiroquai_virtual_insanity"], "stay": ["gotts_street_park_tell_me_why", "thandii_give_me_a_smile"], "slow_down": ["loyle_carner_aint_nothing_changed", "thievery_corporation_music_to_make_you_stagger"] } },
    { "id": "khruangbin_mr_white", "title": "Mr. White", "artist": "Khruangbin", "bpm": 102, "key": "11A", "energy": 2, "tags": ["psychedelic-rock", "funk", "chill", "instrumental"], "suggestions": { "speed_up": ["arc_de_soleil_the_thief_in_marrakesh", "daft_punk_voyager"], "stay": ["my_baby_sunroof_diesel_blues", "fat_freddys_drop_wandering_eye"], "slow_down": ["jamiroquai_virtual_insanity", "benny_sings_big_brown_eyes"] } },
    { "id": "fat_freddys_drop_wandering_eye", "title": "Wandering Eye", "artist": "Fat Freddy's Drop", "bpm": 105, "key": "5A", "energy": 3, "tags": ["reggae", "dub", "soul", "organic", "nz"], "suggestions": { "speed_up": ["maribou_state_kingdom", "pigeon_miami"], "stay": ["arc_de_soleil_the_thief_in_marrakesh", "khruangbin_mr_white"], "slow_down": ["my_baby_sunroof_diesel_blues", "jamiroquai_virtual_insanity"] } },
    { "id": "stavroz_in_mindibu", "title": "In Mindibu", "artist": "Stavroz", "bpm": 87, "key": "7A", "energy": 2, "tags": ["electronic", "deep-house", "organic", "jazz", "slow-house"], "suggestions": { "speed_up": ["gotts_street_park_tell_me_why", "thandii_give_me_a_smile"], "stay": ["thievery_corporation_music_to_make_you_stagger", "air_la_femme_dargent"], "slow_down": ["air_la_femme_dargent"] } },
    { "id": "pigeon_miami", "title": "Miami", "artist": "Pigeon", "bpm": 110, "key": "1A", "energy": 3, "tags": ["indie-pop", "groove", "synth", "smooth"], "suggestions": { "speed_up": ["daft_punk_voyager", "gorillaz_andromeda"], "stay": ["maribou_state_kingdom", "getdown_services_the_radiator"], "slow_down": ["arc_de_soleil_the_thief_in_marrakesh", "fat_freddys_drop_wandering_eye"] } },
    { "id": "jamiroquai_virtual_insanity", "title": "Virtual Insanity (Remastered 2006)", "artist": "Jamiroquai", "bpm": 98, "key": "4A", "energy": 3, "tags": ["acid-jazz", "funk", "classic", "uk"], "suggestions": { "speed_up": ["khruangbin_mr_white", "arc_de_soleil_the_thief_in_marrakesh"], "stay": ["benny_sings_big_brown_eyes", "greentea_peng_stuck_in_the_middle"], "slow_down": ["thandii_give_me_a_smile", "bonobo_days_to_come"] } },
    { "id": "daft_punk_voyager", "title": "Voyager", "artist": "Daft Punk", "bpm": 111, "key": "3A", "energy": 3, "tags": ["french-house", "electronic", "classic", "bassline"], "suggestions": { "speed_up": ["gorillaz_andromeda", "moods_all_for_you"], "stay": ["pigeon_miami", "getdown_services_the_radiator"], "slow_down": ["maribou_state_kingdom", "fat_freddys_drop_wandering_eye"] } },
    { "id": "getdown_services_the_radiator", "title": "The Radiator", "artist": "Getdown Services", "bpm": 117, "key": "11A", "energy": 3, "tags": ["indie-funk", "quirky", "post-punk-disco", "talk-vocals"], "suggestions": { "speed_up": ["jungle_beat_54_all_good_now", "asl_caius_let_it_go_baby"], "stay": ["gorillaz_andromeda", "daft_punk_voyager"], "slow_down": ["pigeon_miami", "maribou_state_kingdom"] } },
    { "id": "finley_quaye_sunday_shining", "title": "Sunday Shining", "artist": "Finley Quaye", "bpm": 94, "key": "9A", "energy": 2, "tags": ["reggae", "indie", "sunny", "classic"], "suggestions": { "speed_up": ["benny_sings_big_brown_eyes", "jamiroquai_virtual_insanity"], "stay": ["bonobo_days_to_come", "thandii_give_me_a_smile"], "slow_down": ["gotts_street_park_tell_me_why", "george_benson_the_world_is_a_ghetto"] } },
    { "id": "crystal_waters_gypsy_woman", "title": "Gypsy Woman (She's Homeless)", "artist": "Crystal Waters", "bpm": 126, "key": "8A", "energy": 4, "tags": ["house", "classic-house", "90s", "anthem"], "suggestions": { "speed_up": ["armand_van_helden_you_dont_know_me", "barry_cant_swim_still_riding"], "stay": ["folamour_these_are_just_places_to_me_now", "daft_punk_revolution_909"], "slow_down": ["supershy_moment_by_moment", "flight_facilities_down_to_earth"] } },
    { "id": "the_smile_zero_sum", "title": "Zero Sum", "artist": "The Smile", "bpm": 152, "key": "4A", "energy": 5, "tags": ["math-rock", "post-punk", "quirky", "frantic", "radiohead"], "suggestions": { "speed_up": ["the_smile_zero_sum"], "stay": ["the_smile_zero_sum"], "slow_down": ["king_booo_tunes_since_89", "gerry_read_shit_cant_make_anything"] } },
    { "id": "kiki_gyan_disco_dancer", "title": "Disco Dancer (Mixed)", "artist": "Kiki Gyan", "bpm": 121, "key": "11A", "energy": 4, "tags": ["afro-disco", "funk", "vintage", "high-energy"], "suggestions": { "speed_up": ["supershy_moment_by_moment", "barry_cant_swim_god_is_the_space_between_us"], "stay": ["parcels_lightenup_remix", "star_slinger_truth"], "slow_down": ["jungle_beat_54_all_good_now", "dan_kye_focus"] } },
    { "id": "parcels_myenemy", "title": "Myenemy (from Hansa Studios, Berlin)", "artist": "Parcels", "bpm": 116, "key": "5A", "energy": 3, "tags": ["indie-pop", "nu-disco", "live", "smooth"], "suggestions": { "speed_up": ["jungle_beat_54_all_good_now", "asl_caius_let_it_go_baby"], "stay": ["maribou_state_midas", "maribou_state_tongue"], "slow_down": ["gorillaz_andromeda", "dam_swindle_yes_no_maybe"] } },
    { "id": "nimino_i_only_smoke_when_i_drink", "title": "I Only Smoke When I Drink", "artist": "nimino", "bpm": 115, "key": "6A", "energy": 3, "tags": ["electronic", "deep-house", "chill-step", "smooth"], "suggestions": { "speed_up": ["asl_caius_let_it_go_baby", "star_slinger_truth"], "stay": ["maribou_state_midas", "dam_swindle_yes_no_maybe"], "slow_down": ["gorillaz_andromeda", "getdown_services_the_radiator"] } },
    { "id": "rampa_les_gout", "title": "Les Gout", "artist": "Rampa, Chuala, Keinemusik", "bpm": 124, "key": "5A", "energy": 3, "tags": ["afro-house", "deep-house", "hypnotic", "keinemusik"], "suggestions": { "speed_up": ["avaion_wacuka", "jaded_carlita_zorro"], "stay": ["barry_cant_swim_can_we_still_be_friends", "supershy_moment_by_moment"], "slow_down": ["bonobo_rosewood", "fred_again_places_to_be"] } },
    { "id": "hozier_eat_your_young", "title": "Eat Your Young", "artist": "Hozier", "bpm": 92, "key": "11B", "energy": 3, "tags": ["indie-rock", "soulful", "dark-pop", "heavy-groove"], "suggestions": { "speed_up": ["jamiroquai_virtual_insanity", "khruangbin_mr_white"], "stay": ["benny_sings_big_brown_eyes", "greentea_peng_stuck_in_the_middle"], "slow_down": ["bonobo_days_to_come", "gotts_street_park_tell_me_why"] } },
    { "id": "greentea_peng_stuck_in_the_middle", "title": "Stuck In The Middle", "artist": "Greentea Peng", "bpm": 95, "key": "8A", "energy": 2, "tags": ["neo-soul", "psychedelic-rnb", "reggae-vibe", "smoky"], "suggestions": { "speed_up": ["jamiroquai_virtual_insanity", "khruangbin_mr_white"], "stay": ["benny_sings_big_brown_eyes", "hozier_eat_your_young"], "slow_down": ["bonobo_days_to_come", "gotts_street_park_tell_me_why"] } },
    { "id": "klaus_layer_lose_control", "title": "Lose Control", "artist": "Rick Flair, Klaus Layer", "bpm": 90, "key": "2A", "energy": 2, "tags": ["instrumental-hip-hop", "boom-bap", "lo-fi", "vinyl"], "suggestions": { "speed_up": ["benny_sings_big_brown_eyes", "hozier_eat_your_young"], "stay": ["thandii_give_me_a_smile", "gotts_street_park_tell_me_why"], "slow_down": ["loyle_carner_aint_nothing_changed", "george_benson_the_world_is_a_ghetto"] } },
    { "id": "terrence_park_somethin_here", "title": "Somethin’ Here (Original Mix)", "artist": "Terrence Parker", "bpm": 125, "key": "7A", "energy": 4, "tags": ["classic-house", "detroit-house", "piano-house", "uplifting"], "suggestions": { "speed_up": ["armand_van_helden_you_dont_know_me", "daft_punk_revolution_909"], "stay": ["dutchican_soul_be_funky", "supershy_moment_by_moment"], "slow_down": ["flight_facilities_down_to_earth", "barry_cant_swim_can_we_still_be_friends"] } },
    { "id": "lazywax_santa_catarina", "title": "Santa Catarina", "artist": "Lazywax", "bpm": 118, "key": "9A", "energy": 3, "tags": ["nu-disco", "italo-disco", "synths", "retro"], "suggestions": { "speed_up": ["parcels_lightenup_remix", "star_slinger_truth"], "stay": ["jungle_beat_54_all_good_now", "asl_caius_let_it_go_baby"], "slow_down": ["maribou_state_midas", "nimino_i_only_smoke_when_i_drink"] } },
    { "id": "daft_punk_revolution_909", "title": "Revolution 909", "artist": "Daft Punk", "bpm": 126, "key": "2A", "energy": 4, "tags": ["french-house", "classic", "90s", "groove"], "suggestions": { "speed_up": ["barry_cant_swim_still_riding", "my_baby_smiley_virus"], "stay": ["jaded_carlita_zorro", "shir_t_hackney_birdwatch"], "slow_down": ["supershy_moment_by_moment", "barry_cant_swim_sunsleeper"] } }
  ];

  function init(){
    if (!localStorage.getItem(DB_KEY)) {
      localStorage.setItem(DB_KEY, JSON.stringify(DEFAULT_DATABASE));
    }
  }

  function getDatabase(){
    try {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_DATABASE.slice();
    } catch (e) {
      return DEFAULT_DATABASE.slice();
    }
  }

  function saveDatabase(db){
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function normalize(str){
    return (str || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function tokenize(str){
    return normalize(str).split(' ').filter(Boolean);
  }

  // Fuzzy-matches a YouTube track against a database song entry by comparing
  // normalized titles and overlapping artist tokens. There's no shared ID
  // space between the curated DB (hand-written slugs) and YouTube video IDs,
  // so this heuristic is the only way to connect the two.
  function scoreMatch(track, song){
    const tTitle = normalize(track.title), sTitle = normalize(song.title);
    let score = 0;
    if (tTitle === sTitle) score += 10;
    else if (tTitle && sTitle && (tTitle.includes(sTitle) || sTitle.includes(tTitle))) score += 6;
    const sArtistTokens = tokenize(song.artist);
    const tArtistTokens = tokenize(track.artist);
    const overlap = sArtistTokens.filter(t => tArtistTokens.includes(t)).length;
    score += overlap * 2;
    return score;
  }

  const MATCH_THRESHOLD = 6;

  function findTrackIndexForSong(song, tracks){
    let bestIdx = -1, bestScore = 0;
    tracks.forEach((t, idx) => {
      const sc = scoreMatch(t, song);
      if (sc > bestScore) { bestScore = sc; bestIdx = idx; }
    });
    return bestScore >= MATCH_THRESHOLD ? bestIdx : -1;
  }

  function findSongForTrack(track, db){
    let best = null, bestScore = 0;
    db.forEach(song => {
      const sc = scoreMatch(track, song);
      if (sc > bestScore) { bestScore = sc; best = song; }
    });
    return bestScore >= MATCH_THRESHOLD ? best : null;
  }

  function firstAvailable(ids, db, tracks, exclude){
    for (const id of (ids || [])) {
      const song = db.find(s => s.id === id);
      if (!song) continue;
      const idx = findTrackIndexForSong(song, tracks);
      if (idx !== -1 && !exclude.has(idx)) return idx;
    }
    return -1;
  }

  function randomIdxExcluding(tracks, exclude){
    const opts = tracks.map((t, idx) => idx).filter(idx => !exclude.has(idx));
    const pool = opts.length ? opts : tracks.map((t, idx) => idx).filter(idx => !exclude.has(idx) || idx === undefined);
    const finalPool = pool.length ? pool : tracks.map((t, idx) => idx);
    return finalPool[Math.floor(Math.random() * finalPool.length)];
  }

  // mode: 'sequential' | 'curated' | 'pure'
  function getSuggestions({ tracks, currentIndex, mode, history }){
    const db = getDatabase();
    const currentTrack = tracks[currentIndex];
    const song = findSongForTrack(currentTrack, db);
    const recentIds = new Set((history || []).slice(-3).map(t => t.id).concat([currentTrack.id]));
    const recentIdxs = new Set(
      tracks.map((t, idx) => idx).filter(idx => recentIds.has(tracks[idx].id))
    );
    recentIdxs.add(currentIndex);

    const used = new Set(recentIdxs);

    let fireIdx = song ? firstAvailable(song.suggestions.speed_up, db, tracks, used) : -1;
    if (fireIdx !== -1) used.add(fireIdx);

    let moonIdx = song ? firstAvailable(song.suggestions.slow_down, db, tracks, used) : -1;
    if (moonIdx !== -1) used.add(moonIdx);

    let waveIdx;
    if (mode === 'sequential') {
      waveIdx = (currentIndex + 1) % tracks.length;
    } else if (mode === 'curated') {
      waveIdx = song ? firstAvailable(song.suggestions.stay, db, tracks, used) : -1;
      if (waveIdx === -1) waveIdx = (currentIndex + 1) % tracks.length;
    } else {
      // pure random: pick a fully random song from the whole database,
      // then map it back to a track in the current playlist if possible.
      waveIdx = -1;
      if (db.length) {
        const randomSong = db[Math.floor(Math.random() * db.length)];
        waveIdx = findTrackIndexForSong(randomSong, tracks);
      }
      if (waveIdx === -1 || used.has(waveIdx)) waveIdx = randomIdxExcluding(tracks, used);
    }
    used.add(waveIdx);

    if (fireIdx === -1) fireIdx = randomIdxExcluding(tracks, used);
    used.add(fireIdx);
    if (moonIdx === -1) moonIdx = randomIdxExcluding(tracks, used);

    return {
      up: { t: tracks[fireIdx], idx: fireIdx },
      flow: { t: tracks[waveIdx], idx: waveIdx },
      down: { t: tracks[moonIdx], idx: moonIdx }
    };
  }

  function getBPM(track){
    const db = getDatabase();
    const song = findSongForTrack(track, db);
    return song ? song.bpm : null;
  }

  function makeId(track){
    const slug = normalize(track.artist + ' ' + track.title).replace(/ /g, '_');
    return slug || track.id;
  }

  // Looks up (or creates) the database entry for a YouTube track and returns
  // it together with the live db array, so callers can edit it in place.
  function getOrCreateSongForTrack(track){
    const db = getDatabase();
    let song = findSongForTrack(track, db);
    if (!song) {
      song = {
        id: makeId(track),
        title: track.title,
        artist: track.artist,
        bpm: null,
        key: '',
        energy: 3,
        tags: [],
        suggestions: { speed_up: [], stay: [], slow_down: [] }
      };
      db.push(song);
    }
    return { db, song };
  }

  function upsertSongForTrack(track, fields){
    const { db, song } = getOrCreateSongForTrack(track);
    Object.assign(song, fields);
    saveDatabase(db);
    return song;
  }

  window.TokEngine = {
    init, getDatabase, saveDatabase, getSuggestions, findSongForTrack, getBPM,
    getOrCreateSongForTrack, upsertSongForTrack
  };
})();
