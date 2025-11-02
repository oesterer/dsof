package com.dsof.rest.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
@EnableConfigurationProperties(DatabaseProperties.class)
public class DatabaseConfig {

    private final DatabaseProperties properties;

    public DatabaseConfig(DatabaseProperties properties) {
        this.properties = properties;
    }

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://" + properties.getHost() + ":" + properties.getPort() + "/" + properties.getDatabase() + "?serverTimezone=UTC&useSSL=false");
        config.setUsername(properties.getUser());
        config.setPassword(resolvePassword());
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setPoolName("dsof-mysql-pool");
        return new HikariDataSource(config);
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    private String resolvePassword() {
        if (properties.getPassword() != null && !properties.getPassword().isBlank()) {
            return properties.getPassword();
        }
        Path path = Path.of(properties.getPasswordFile());
        try {
            if (Files.exists(path)) {
                return Files.readString(path, StandardCharsets.UTF_8).trim();
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read MySQL password from " + path, ex);
        }
        throw new IllegalStateException("MySQL password not provided. Set dsof.datasource.password or create " + path);
    }
}
