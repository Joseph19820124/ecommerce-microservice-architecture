package com.ecommerce.product.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateProductImageRequest {

    @NotBlank(message = "Image URL is required")
    private String url;

    private String altText;

    private Integer sortOrder;

    private Boolean isPrimary;
}
