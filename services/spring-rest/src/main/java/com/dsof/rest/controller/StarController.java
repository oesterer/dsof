package com.dsof.rest.controller;

import com.dsof.rest.model.StarDto;
import com.dsof.rest.model.StarQuery;
import com.dsof.rest.service.StarService;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stars")
@Validated
public class StarController {

    private final StarService starService;

    public StarController(StarService starService) {
        this.starService = starService;
    }

    @GetMapping
    public List<StarDto> listStars(
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "minMagnitude", required = false) Double minMagnitude,
            @RequestParam(value = "maxMagnitude", required = false) Double maxMagnitude,
            @RequestParam(value = "constellation", required = false) String constellation
    ) {
        StarQuery query = new StarQuery(limit, minMagnitude, maxMagnitude, constellation);
        return starService.findStars(query);
    }

    @GetMapping("/{hrNumber}")
    public ResponseEntity<StarDto> getStar(@PathVariable("hrNumber") int hrNumber) {
        return starService.findByHrNumber(hrNumber)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
