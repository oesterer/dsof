package com.dsof.rest.service;

import com.dsof.rest.model.PlanetDto;
import com.dsof.rest.model.PlanetOrbitalElementsDto;
import com.dsof.rest.repository.PlanetRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PlanetService {

    private final PlanetRepository planetRepository;

    public PlanetService(PlanetRepository planetRepository) {
        this.planetRepository = planetRepository;
    }

    public List<PlanetDto> findAll() {
        return planetRepository.findAll();
    }

    public Optional<PlanetDto> findByName(String name) {
        return Optional.ofNullable(planetRepository.findByName(name));
    }

    public Optional<PlanetOrbitalElementsDto> findOrbitalElements(String name) {
        return Optional.ofNullable(planetRepository.findOrbitalElements(name));
    }
}
