const Category = require('./categoryModel');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .select('-__v')
      .sort({ categoryId: 1 }); 

    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Get All Categories Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get category by ID (using MongoDB _id)
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.categoryId)
      .select('-__v');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        errors: [{ message: 'No category found with this ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category retrieved successfully',
      data: category
    });
  } catch (error) {
    console.error('Get Category By ID Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get category by categoryId (numeric)
exports.getCategoryByCategoryId = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
        errors: [{ message: 'Category ID must be a number' }]
      });
    }

    const category = await Category.findOne({ categoryId })
      .select('-__v');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        errors: [{ message: 'No category found with this category ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category retrieved successfully',
      data: category
    });
  } catch (error) {
    console.error('Get Category By CategoryId Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Create new category
exports.createCategory = async (req, res) => {
  const { name, isActive } = req.body;

  try {
    // Check for duplicate category name
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'name', message: 'Category name already exists' }]
      });
    }

    const category = new Category({
      name,
      isActive: isActive !== undefined ? isActive : true
    });

    await category.save();

    const newCategory = await Category.findById(category._id)
      .select('-__v');

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory
    });
  } catch (error) {
    console.error('Create Category Error:', error.message);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Update category by ID
exports.updateCategoryById = async (req, res) => {
  const { name, isActive } = req.body;

  try {
    const category = await Category.findById(req.params.categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        errors: [{ message: 'No category found with this ID' }]
      });
    }

    // Check for duplicate category name (excluding current category)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: category._id } });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'name', message: 'Category name already exists' }]
        });
      }
    }

    // Update allowed fields
    if (name) category.name = name;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    const updatedCategory = await Category.findById(category._id)
      .select('-__v');

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    console.error('Update Category Error:', error.message);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Update category by categoryId (numeric)
exports.updateCategoryByCategoryId = async (req, res) => {
  const { name, isActive } = req.body;

  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
        errors: [{ message: 'Category ID must be a number' }]
      });
    }

    const category = await Category.findOne({ categoryId });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        errors: [{ message: 'No category found with this category ID' }]
      });
    }

    // Check for duplicate category name (excluding current category)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: category._id } });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'name', message: 'Category name already exists' }]
        });
      }
    }

    // Update allowed fields
    if (name) category.name = name;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    const updatedCategory = await Category.findById(category._id)
      .select('-__v');

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    console.error('Update Category Error:', error.message);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Delete category by ID
exports.deleteCategoryById = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        errors: [{ message: 'No category found with this ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete Category Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Delete category by categoryId (numeric)
exports.deleteCategoryByCategoryId = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
        errors: [{ message: 'Category ID must be a number' }]
      });
    }

    const category = await Category.findOneAndDelete({ categoryId });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        errors: [{ message: 'No category found with this category ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete Category Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};