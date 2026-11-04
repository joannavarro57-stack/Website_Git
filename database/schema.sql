CREATE TABLE IF NOT EXISTS mailing_list_subscribers (
	id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	email VARCHAR(254) NOT NULL,
	source VARCHAR(100) NOT NULL DEFAULT 'homepage',
	subscribed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_mailing_list_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- YouTube plays and clicks, recorded by track.php and shown on admin.php.
-- db.php also creates this table automatically the first time it connects.
CREATE TABLE IF NOT EXISTS video_clicks (
	id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	video_id VARCHAR(11) NOT NULL,
	title VARCHAR(200) NOT NULL DEFAULT '',
	kind ENUM('play', 'link') NOT NULL,
	page VARCHAR(100) NOT NULL,
	clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_video_clicks_video (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Free downloads (MIDI, PDF and MusicXML), recorded by midi.php and shown on admin.php. Also created automatically by db.php.
CREATE TABLE IF NOT EXISTS midi_downloads (
	id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	song_id VARCHAR(100) NOT NULL,
	format VARCHAR(10) NOT NULL DEFAULT 'midi',
	downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_midi_downloads_song (song_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Play it yourself" songs, managed on php/songs.php. Created (and first filled from data/midi-songs.json) by catalog.php.
CREATE TABLE IF NOT EXISTS songs (
	id VARCHAR(100) NOT NULL,
	title VARCHAR(200) NOT NULL,
	artist VARCHAR(200) NOT NULL,
	description TEXT NOT NULL,
	youtube_id VARCHAR(11) NOT NULL DEFAULT '',
	midi_file VARCHAR(255) NULL,
	pdf_file VARCHAR(255) NULL,
	musicxml_file VARCHAR(255) NULL,
	position INT UNSIGNED NOT NULL DEFAULT 0,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
