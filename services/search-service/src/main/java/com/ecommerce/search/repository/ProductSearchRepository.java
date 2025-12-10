package com.ecommerce.search.repository;

import com.ecommerce.search.document.ProductDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ProductSearchRepository extends ElasticsearchRepository<ProductDocument, String> {

    Page<ProductDocument> findByNameContainingOrDescriptionContaining(
            String name, String description, Pageable pageable);

    Page<ProductDocument> findByCategoryId(String categoryId, Pageable pageable);

    Page<ProductDocument> findByBrandId(String brandId, Pageable pageable);

    Page<ProductDocument> findByTagsContaining(String tag, Pageable pageable);

    Page<ProductDocument> findByPriceBetween(BigDecimal minPrice, BigDecimal maxPrice, Pageable pageable);

    Page<ProductDocument> findByActiveTrue(Pageable pageable);

    Page<ProductDocument> findByFeaturedTrueAndActiveTrue(Pageable pageable);

    Page<ProductDocument> findByInStockTrueAndActiveTrue(Pageable pageable);

    List<ProductDocument> findByCategoryIdAndActiveTrue(String categoryId);

    long countByCategoryId(String categoryId);

    long countByBrandId(String brandId);
}
