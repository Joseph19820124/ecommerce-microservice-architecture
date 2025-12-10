package com.ecommerce.search.service;

import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import co.elastic.clients.elasticsearch._types.query_dsl.*;
import com.ecommerce.search.document.ProductDocument;
import com.ecommerce.search.dto.AutocompleteResponse;
import com.ecommerce.search.dto.SearchRequest;
import com.ecommerce.search.dto.SearchResponse;
import com.ecommerce.search.repository.ProductSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductSearchService {

    private final ProductSearchRepository productSearchRepository;
    private final ElasticsearchOperations elasticsearchOperations;

    public SearchResponse search(SearchRequest request) {
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 20;

        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();

        // Must be active
        boolQueryBuilder.must(TermQuery.of(t -> t.field("active").value(true))._toQuery());

        // Text search
        if (request.getQuery() != null && !request.getQuery().isBlank()) {
            boolQueryBuilder.must(MultiMatchQuery.of(m -> m
                    .query(request.getQuery())
                    .fields("name^3", "description^2", "brandName", "categoryName", "tags")
                    .type(TextQueryType.BestFields)
                    .fuzziness("AUTO")
            )._toQuery());
        }

        // Category filter
        if (request.getCategoryId() != null) {
            boolQueryBuilder.filter(TermQuery.of(t -> t.field("categoryId").value(request.getCategoryId()))._toQuery());
        }

        // Brand filter
        if (request.getBrandId() != null) {
            boolQueryBuilder.filter(TermQuery.of(t -> t.field("brandId").value(request.getBrandId()))._toQuery());
        }

        // Tags filter
        if (request.getTags() != null && !request.getTags().isEmpty()) {
            for (String tag : request.getTags()) {
                boolQueryBuilder.filter(TermQuery.of(t -> t.field("tags").value(tag))._toQuery());
            }
        }

        // Price range filter
        if (request.getMinPrice() != null || request.getMaxPrice() != null) {
            RangeQuery.Builder rangeBuilder = new RangeQuery.Builder().field("price");
            if (request.getMinPrice() != null) {
                rangeBuilder.gte(co.elastic.clients.json.JsonData.of(request.getMinPrice()));
            }
            if (request.getMaxPrice() != null) {
                rangeBuilder.lte(co.elastic.clients.json.JsonData.of(request.getMaxPrice()));
            }
            boolQueryBuilder.filter(rangeBuilder.build()._toQuery());
        }

        // Rating filter
        if (request.getMinRating() != null) {
            boolQueryBuilder.filter(RangeQuery.of(r -> r
                    .field("averageRating")
                    .gte(co.elastic.clients.json.JsonData.of(request.getMinRating()))
            )._toQuery());
        }

        // In stock filter
        if (request.getInStock() != null && request.getInStock()) {
            boolQueryBuilder.filter(TermQuery.of(t -> t.field("inStock").value(true))._toQuery());
        }

        // Featured filter
        if (request.getFeatured() != null && request.getFeatured()) {
            boolQueryBuilder.filter(TermQuery.of(t -> t.field("featured").value(true))._toQuery());
        }

        // Build sort
        Sort sort = buildSort(request.getSortBy(), request.getSortOrder());

        NativeQuery query = NativeQuery.builder()
                .withQuery(boolQueryBuilder.build()._toQuery())
                .withPageable(PageRequest.of(page, size, sort))
                .build();

        SearchHits<ProductDocument> searchHits = elasticsearchOperations.search(query, ProductDocument.class);

        List<ProductDocument> products = searchHits.getSearchHits().stream()
                .map(SearchHit::getContent)
                .collect(Collectors.toList());

        long totalHits = searchHits.getTotalHits();
        int totalPages = (int) Math.ceil((double) totalHits / size);

        return SearchResponse.builder()
                .products(products)
                .totalHits(totalHits)
                .page(page)
                .size(size)
                .totalPages(totalPages)
                .build();
    }

    public AutocompleteResponse autocomplete(String query, int limit) {
        if (query == null || query.length() < 2) {
            return AutocompleteResponse.builder().suggestions(Collections.emptyList()).build();
        }

        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder()
                .must(TermQuery.of(t -> t.field("active").value(true))._toQuery())
                .must(MultiMatchQuery.of(m -> m
                        .query(query)
                        .fields("name^3", "brandName", "categoryName")
                        .type(TextQueryType.PhrasePrefix)
                )._toQuery());

        NativeQuery nativeQuery = NativeQuery.builder()
                .withQuery(boolQueryBuilder.build()._toQuery())
                .withPageable(PageRequest.of(0, limit))
                .build();

        SearchHits<ProductDocument> searchHits = elasticsearchOperations.search(nativeQuery, ProductDocument.class);

        List<AutocompleteResponse.Suggestion> suggestions = searchHits.getSearchHits().stream()
                .map(hit -> {
                    ProductDocument product = hit.getContent();
                    return AutocompleteResponse.Suggestion.builder()
                            .text(product.getName())
                            .type("product")
                            .id(product.getId())
                            .imageUrl(product.getImageUrl())
                            .build();
                })
                .collect(Collectors.toList());

        return AutocompleteResponse.builder().suggestions(suggestions).build();
    }

    public void indexProduct(ProductDocument product) {
        productSearchRepository.save(product);
        log.info("Indexed product: {}", product.getId());
    }

    public void updateProduct(ProductDocument product) {
        productSearchRepository.save(product);
        log.info("Updated product in index: {}", product.getId());
    }

    public void deleteProduct(String productId) {
        productSearchRepository.deleteById(productId);
        log.info("Deleted product from index: {}", productId);
    }

    public Optional<ProductDocument> getProductById(String productId) {
        return productSearchRepository.findById(productId);
    }

    public List<ProductDocument> getFeaturedProducts(int limit) {
        return productSearchRepository.findByFeaturedTrueAndActiveTrue(PageRequest.of(0, limit))
                .getContent();
    }

    public List<ProductDocument> getProductsByCategory(String categoryId, int limit) {
        return productSearchRepository.findByCategoryId(categoryId, PageRequest.of(0, limit))
                .getContent();
    }

    public List<ProductDocument> getSimilarProducts(String productId, int limit) {
        Optional<ProductDocument> productOpt = productSearchRepository.findById(productId);
        if (productOpt.isEmpty()) {
            return Collections.emptyList();
        }

        ProductDocument product = productOpt.get();

        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder()
                .must(TermQuery.of(t -> t.field("active").value(true))._toQuery())
                .mustNot(TermQuery.of(t -> t.field("_id").value(productId))._toQuery())
                .should(TermQuery.of(t -> t.field("categoryId").value(product.getCategoryId()))._toQuery())
                .should(TermQuery.of(t -> t.field("brandId").value(product.getBrandId()))._toQuery());

        if (product.getTags() != null) {
            for (String tag : product.getTags()) {
                boolQueryBuilder.should(TermQuery.of(t -> t.field("tags").value(tag))._toQuery());
            }
        }

        boolQueryBuilder.minimumShouldMatch("1");

        NativeQuery query = NativeQuery.builder()
                .withQuery(boolQueryBuilder.build()._toQuery())
                .withPageable(PageRequest.of(0, limit))
                .build();

        SearchHits<ProductDocument> searchHits = elasticsearchOperations.search(query, ProductDocument.class);

        return searchHits.getSearchHits().stream()
                .map(SearchHit::getContent)
                .collect(Collectors.toList());
    }

    private Sort buildSort(String sortBy, String sortOrder) {
        if (sortBy == null || sortBy.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }

        Sort.Direction direction = "asc".equalsIgnoreCase(sortOrder) ?
                Sort.Direction.ASC : Sort.Direction.DESC;

        return switch (sortBy.toLowerCase()) {
            case "price" -> Sort.by(direction, "price");
            case "rating" -> Sort.by(direction, "averageRating");
            case "sales" -> Sort.by(direction, "salesCount");
            case "name" -> Sort.by(direction, "name.keyword");
            case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt");
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }
}
