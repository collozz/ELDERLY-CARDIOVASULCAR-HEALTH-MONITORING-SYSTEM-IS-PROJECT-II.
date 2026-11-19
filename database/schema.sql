-- Database tables

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS tbl_notification, tbl_alert, tbl_health_reading, tbl_device,
  tbl_threshold, tbl_provider_assignment, tbl_caregiver_assignment,
  tbl_healthcare_provider, tbl_elderly_profile, tbl_caregiver,
  tbl_activity_log, tbl_user, tbl_role;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users and roles

CREATE TABLE tbl_role (
  role_id      INT          NOT NULL AUTO_INCREMENT,
  role_name    VARCHAR(50)  NOT NULL,
  description  VARCHAR(255) NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_role_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE tbl_user (
  user_id        INT          NOT NULL AUTO_INCREMENT,
  role_id        INT          NOT NULL,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL,
  phone_number   VARCHAR(20)  NULL,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email),
  CONSTRAINT fk_user_role FOREIGN KEY (role_id)
    REFERENCES tbl_role (role_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE tbl_activity_log (
  log_id     INT          NOT NULL AUTO_INCREMENT,
  user_id    INT          NOT NULL,
  action     VARCHAR(100) NOT NULL,
  details    TEXT         NULL,
  logged_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_log_user_time (user_id, logged_at),
  CONSTRAINT fk_log_user FOREIGN KEY (user_id)
    REFERENCES tbl_user (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2. User profiles

CREATE TABLE tbl_caregiver (
  caregiver_id  INT         NOT NULL AUTO_INCREMENT,
  user_id       INT         NOT NULL,
  relationship  VARCHAR(50) NULL COMMENT 'e.g. Daughter, Son, Nurse',
  PRIMARY KEY (caregiver_id),
  UNIQUE KEY uq_caregiver_user (user_id),
  CONSTRAINT fk_caregiver_user FOREIGN KEY (user_id)
    REFERENCES tbl_user (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tbl_elderly_profile (
  elderly_id               INT          NOT NULL AUTO_INCREMENT,
  user_id                  INT          NOT NULL,
  date_of_birth            DATE         NOT NULL,
  gender                   VARCHAR(10)  NULL,
  address                  VARCHAR(255) NULL,
  medical_history          TEXT         NULL,
  emergency_contact_name   VARCHAR(100) NOT NULL,
  emergency_contact_phone  VARCHAR(20)  NOT NULL,
  PRIMARY KEY (elderly_id),
  UNIQUE KEY uq_elderly_user (user_id),
  CONSTRAINT chk_elderly_gender CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
  CONSTRAINT fk_elderly_user FOREIGN KEY (user_id)
    REFERENCES tbl_user (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tbl_healthcare_provider (
  provider_id     INT          NOT NULL AUTO_INCREMENT,
  user_id         INT          NOT NULL,
  specialization  VARCHAR(100) NULL,
  license_number  VARCHAR(50)  NOT NULL,
  PRIMARY KEY (provider_id),
  UNIQUE KEY uq_provider_user (user_id),
  UNIQUE KEY uq_provider_license (license_number),
  CONSTRAINT fk_provider_user FOREIGN KEY (user_id)
    REFERENCES tbl_user (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Care assignments

CREATE TABLE tbl_caregiver_assignment (
  assignment_id  INT      NOT NULL AUTO_INCREMENT,
  caregiver_id   INT      NOT NULL,
  elderly_id     INT      NOT NULL,
  assigned_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id),
  UNIQUE KEY uq_caregiver_elderly (caregiver_id, elderly_id),
  CONSTRAINT fk_cga_caregiver FOREIGN KEY (caregiver_id)
    REFERENCES tbl_caregiver (caregiver_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cga_elderly FOREIGN KEY (elderly_id)
    REFERENCES tbl_elderly_profile (elderly_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tbl_provider_assignment (
  assignment_id  INT      NOT NULL AUTO_INCREMENT,
  provider_id    INT      NOT NULL,
  elderly_id     INT      NOT NULL,
  assigned_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id),
  UNIQUE KEY uq_provider_elderly (provider_id, elderly_id),
  CONSTRAINT fk_pva_provider FOREIGN KEY (provider_id)
    REFERENCES tbl_healthcare_provider (provider_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pva_elderly FOREIGN KEY (elderly_id)
    REFERENCES tbl_elderly_profile (elderly_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Thresholds

CREATE TABLE tbl_threshold (
  threshold_id  INT          NOT NULL AUTO_INCREMENT,
  elderly_id    INT          NOT NULL,
  provider_id   INT          NULL COMMENT 'NULL = system default',
  vital_type    VARCHAR(20)  NOT NULL,
  min_value     DECIMAL(5,1) NOT NULL,
  max_value     DECIMAL(5,1) NOT NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (threshold_id),
  UNIQUE KEY uq_threshold_elderly_vital (elderly_id, vital_type),
  CONSTRAINT chk_threshold_vital CHECK (vital_type IN ('heart_rate_bpm', 'temperature_c', 'spo2_percent')),
  CONSTRAINT chk_threshold_range CHECK (min_value < max_value),
  CONSTRAINT fk_threshold_elderly FOREIGN KEY (elderly_id)
    REFERENCES tbl_elderly_profile (elderly_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_threshold_provider FOREIGN KEY (provider_id)
    REFERENCES tbl_healthcare_provider (provider_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. Devices and readings

CREATE TABLE tbl_device (
  device_id       INT         NOT NULL AUTO_INCREMENT,
  elderly_id      INT         NOT NULL,
  device_type     VARCHAR(50) NOT NULL COMMENT 'e.g. ESP32 DevKit V1',
  serial_number   VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'Active',
  last_synced_at  DATETIME    NULL,
  PRIMARY KEY (device_id),
  UNIQUE KEY uq_device_serial (serial_number),
  CONSTRAINT chk_device_status CHECK (status IN ('Active', 'Inactive', 'Faulty')),
  CONSTRAINT fk_device_elderly FOREIGN KEY (elderly_id)
    REFERENCES tbl_elderly_profile (elderly_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tbl_health_reading (
  reading_id      INT          NOT NULL AUTO_INCREMENT,
  device_id       INT          NOT NULL,
  heart_rate_bpm  INT          NOT NULL,
  temperature_c   DECIMAL(4,1) NULL,
  spo2_percent    DECIMAL(5,2) NULL,
  recorded_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reading_id),
  KEY idx_reading_device_time (device_id, recorded_at),
  CONSTRAINT chk_reading_hr   CHECK (heart_rate_bpm BETWEEN 20 AND 250),
  CONSTRAINT chk_reading_temp CHECK (temperature_c IS NULL OR temperature_c BETWEEN 30.0 AND 45.0),
  CONSTRAINT chk_reading_spo2 CHECK (spo2_percent IS NULL OR spo2_percent BETWEEN 50.00 AND 100.00),
  CONSTRAINT fk_reading_device FOREIGN KEY (device_id)
    REFERENCES tbl_device (device_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Alerts and notifications

CREATE TABLE tbl_alert (
  alert_id      INT          NOT NULL AUTO_INCREMENT,
  elderly_id    INT          NOT NULL,
  reading_id    INT          NULL,
  alert_type    VARCHAR(20)  NOT NULL,
  severity      VARCHAR(20)  NOT NULL,
  message       VARCHAR(255) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'Open',
  triggered_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (alert_id),
  UNIQUE KEY uq_alert_reading (reading_id),
  KEY idx_alert_elderly_time (elderly_id, triggered_at),
  CONSTRAINT chk_alert_type     CHECK (alert_type IN ('Threshold', 'Panic')),
  CONSTRAINT chk_alert_severity CHECK (severity IN ('Warning', 'Critical')),
  CONSTRAINT chk_alert_status   CHECK (status IN ('Open', 'Acknowledged', 'Resolved')),
  CONSTRAINT fk_alert_elderly FOREIGN KEY (elderly_id)
    REFERENCES tbl_elderly_profile (elderly_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_alert_reading FOREIGN KEY (reading_id)
    REFERENCES tbl_health_reading (reading_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE tbl_notification (
  notification_id    INT          NOT NULL AUTO_INCREMENT,
  alert_id           INT          NOT NULL,
  recipient_user_id  INT          NOT NULL,
  channel            VARCHAR(10)  NOT NULL,
  message            VARCHAR(255) NOT NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'Pending',
  sent_at            DATETIME     NULL,
  PRIMARY KEY (notification_id),
  KEY idx_notification_alert (alert_id),
  CONSTRAINT chk_notification_channel CHECK (channel IN ('SMS', 'Dashboard', 'Email')),
  CONSTRAINT chk_notification_status  CHECK (status IN ('Pending', 'Sent', 'Failed')),
  CONSTRAINT fk_notification_alert FOREIGN KEY (alert_id)
    REFERENCES tbl_alert (alert_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_notification_user FOREIGN KEY (recipient_user_id)
    REFERENCES tbl_user (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
