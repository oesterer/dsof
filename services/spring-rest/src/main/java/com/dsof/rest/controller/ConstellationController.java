package com.dsof.rest.controller;

import com.dsof.rest.model.ConstellationDetailDto;
import com.dsof.rest.model.ConstellationDto;
import com.dsof.rest.model.StarQuery;
import com.dsof.rest.service.ConstellationService;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/constellations")
@Validated
public class ConstellationController {

    private final ConstellationService constellationService;

    public ConstellationController(ConstellationService constellationService) {
        this.constellationService = constellationService;
    }

    @GetMapping
    public List<ConstellationDto> listConstellations(@RequestParam(value = "abbreviation", required = false) String abbreviation) {
        return constellationService.listConstellations(abbreviation);
    }

    @GetMapping("/{abbreviation}")
    public ResponseEntity<ConstellationDetailDto> getConstellation(
            @PathVariable("abbreviation") String abbreviation,
            @RequestParam(value = "includeStars", defaultValue = "false") boolean includeStars,
            @RequestParam(value = "includeMessier", defaultValue = "false") boolean includeMessier,
            @RequestParam(value = "starLimit", required = false) Integer starLimit,
            @RequestParam(value = "minMagnitude", required = false) Double minMagnitude,
            @RequestParam(value = "maxMagnitude", required = false) Double maxMagnitude
    ) {
        StarQuery starQuery = new StarQuery(
                includeStars ? starLimit : null,
                includeStars ? minMagnitude : null,
                includeStars ? maxMagnitude : null,
                abbreviation
        );

        Optional<ConstellationDetailDto> detail = constellationService.getConstellationDetail(
                abbreviation,
                includeStars,
                includeMessier,
                starQuery
        );
        return detail.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
