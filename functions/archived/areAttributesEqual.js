function areAttributesEqual(newAttributes, currentAttributes) {
    // Compare the attributes arrays
    // You can add more complex comparison logic here if needed
    return JSON.stringify(newAttributes) === JSON.stringify(currentAttributes);
}
