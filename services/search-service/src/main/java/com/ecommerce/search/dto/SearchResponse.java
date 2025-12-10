package com.ecommerce.search.dto;

import com.ecommerce.search.document.ProductDocument;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchResponse {
    private List<ProductDocument> products;
    private long totalHits;
    private int page;
    private int size;
    private int totalPages;
    private Map<String, List<FacetBucket>> facets;
    private List<String> suggestions;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FacetBucket {
        private String key;
        private long count;
    }
}
