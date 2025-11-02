package com.dsof.rest.controller;

import com.dsof.rest.model.MessierObjectDto;
import com.dsof.rest.service.MessierService;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/messier")
@Validated
public class MessierController {

    private final MessierService messierService;

    public MessierController(MessierService messierService) {
        this.messierService = messierService;
    }

    @GetMapping
    public List<MessierObjectDto> listMessierObjects(
            @RequestParam(value = "objectType", required = false) String objectType,
            @RequestParam(value = "constellation", required = false) String constellation
    ) {
        return messierService.findMessierObjects(objectType, constellation);
    }

    @GetMapping("/{designation}")
    public ResponseEntity<MessierObjectDto> getMessierObject(@PathVariable("designation") String designation) {
        return messierService.findByDesignation(designation)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
