package com.ecommerce.search.controller;

import com.ecommerce.search.document.ProductDocument;
import com.ecommerce.search.dto.AutocompleteResponse;
import com.ecommerce.search.dto.SearchRequest;
import com.ecommerce.search.dto.SearchResponse;
import com.ecommerce.search.service.ProductSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
@Slf4j
public class SearchController {

    private final ProductSearchService productSearchService;

    @GetMapping("/products")
    public ResponseEntity<SearchResponse> searchProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String brandId,
            @RequestParam(required = false) List<String> tags,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Float minRating,
            @RequestParam(required = false) Boolean inStock,
            @RequestParam(required = false) Boolean featured,
            @RequestParam(required = false, defaultValue = "newest") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortOrder,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "20") Integer size
    ) {
        log.debug("Search request: query={}, category={}, brand={}", q, categoryId, brandId);

        SearchRequest request = SearchRequest.builder()
                .query(q)
                .categoryId(categoryId)
                .brandId(brandId)
                .tags(tags)
                .minPrice(minPrice)
                .maxPrice(maxPrice)
                .minRating(minRating)
                .inStock(inStock)
                .featured(featured)
                .sortBy(sortBy)
                .sortOrder(sortOrder)
                .page(page)
                .size(size)
                .build();

        SearchResponse response = productSearchService.search(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/products")
    public ResponseEntity<SearchResponse> searchProductsPost(@RequestBody SearchRequest request) {
        log.debug("Search POST request: {}", request);
        SearchResponse response = productSearchService.search(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/autocomplete")
    public ResponseEntity<AutocompleteResponse> autocomplete(
            @RequestParam String q,
            @RequestParam(required = false, defaultValue = "10") Integer limit
    ) {
        log.debug("Autocomplete request: query={}", q);
        AutocompleteResponse response = productSearchService.autocomplete(q, limit);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/products/{productId}")
    public ResponseEntity<ProductDocument> getProduct(@PathVariable String productId) {
        return productSearchService.getProductById(productId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/products/featured")
    public ResponseEntity<List<ProductDocument>> getFeaturedProducts(
            @RequestParam(required = false, defaultValue = "10") Integer limit
    ) {
        List<ProductDocument> products = productSearchService.getFeaturedProducts(limit);
        return ResponseEntity.ok(products);
    }

    @GetMapping("/products/category/{categoryId}")
    public ResponseEntity<List<ProductDocument>> getProductsByCategory(
            @PathVariable String categoryId,
            @RequestParam(required = false, defaultValue = "20") Integer limit
    ) {
        List<ProductDocument> products = productSearchService.getProductsByCategory(categoryId, limit);
        return ResponseEntity.ok(products);
    }

    @GetMapping("/products/{productId}/similar")
    public ResponseEntity<List<ProductDocument>> getSimilarProducts(
            @PathVariable String productId,
            @RequestParam(required = false, defaultValue = "10") Integer limit
    ) {
        List<ProductDocument> products = productSearchService.getSimilarProducts(productId, limit);
        return ResponseEntity.ok(products);
    }

    @PostMapping("/products/index")
    public ResponseEntity<Void> indexProduct(@RequestBody ProductDocument product) {
        productSearchService.indexProduct(product);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/products/{productId}")
    public ResponseEntity<Void> deleteProduct(@PathVariable String productId) {
        productSearchService.deleteProduct(productId);
        return ResponseEntity.noContent().build();
    }
}
