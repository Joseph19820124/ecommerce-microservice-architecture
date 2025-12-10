package com.ecommerce.product.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "product_variants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, unique = true, length = 50)
    private String sku;

    @Column(length = 100)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "compare_at_price", precision = 10, scale = 2)
    private BigDecimal compareAtPrice;

    @Column(name = "option1_name", length = 50)
    private String option1Name;

    @Column(name = "option1_value", length = 100)
    private String option1Value;

    @Column(name = "option2_name", length = 50)
    private String option2Name;

    @Column(name = "option2_value", length = 100)
    private String option2Value;

    @Column(name = "option3_name", length = 50)
    private String option3Name;

    @Column(name = "option3_value", length = 100)
    private String option3Value;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(precision = 8, scale = 2)
    private BigDecimal weight;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;
}
