package com.dsof.rest.controller;

import com.dsof.rest.model.PlanetDto;
import com.dsof.rest.model.PlanetOrbitalElementsDto;
import com.dsof.rest.service.PlanetService;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/planets")
@Validated
public class PlanetController {

    private final PlanetService planetService;

    public PlanetController(PlanetService planetService) {
        this.planetService = planetService;
    }

    @GetMapping
    public List<PlanetDto> listPlanets() {
        return planetService.findAll();
    }

    @GetMapping("/{name}")
    public ResponseEntity<PlanetResponse> getPlanet(@PathVariable("name") String name) {
        Optional<PlanetDto> planetOpt = planetService.findByName(name);
        if (planetOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Optional<PlanetOrbitalElementsDto> orbitalOpt = planetService.findOrbitalElements(name);
        PlanetResponse response = new PlanetResponse(planetOpt.get(), orbitalOpt.orElse(null));
        return ResponseEntity.ok(response);
    }

    public record PlanetResponse(PlanetDto planet, PlanetOrbitalElementsDto orbitalElements) { }
}
