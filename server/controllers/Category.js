const Category = require("../models/Category");

exports.createCategory = async (req, res) => {
	try {
		const { name, description } = req.body;
		if (!name) {
			return res
				.status(400)
				.json({ success: false, message: "All fields are required" });
		}
		const CategorysDetails = await Category.create({
			name: name,
			description: description,
		});
		console.log(CategorysDetails);
		return res.status(200).json({
			success: true,
			message: "Categorys Created Successfully",
		});
	} catch (error) {
		return res.status(500).json({
			success: true,
			message: error.message,
		});
	}
};

exports.showAllCategories = async (req, res) => {
	try {
		const allCategorys = await Category.find({})
			.populate({
				path: "courses",
				match: { status: "Published" },
			})
			.exec();
		res.status(200).json({
			success: true,
			data: allCategorys,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

//categoryPageDetails 

exports.categoryPageDetails = async (req, res) => {
    try {
            //get categoryId
            const {categoryId} = req.body;
            
            // First, get category with ALL courses to debug
            const categoryWithAllCourses = await Category.findById(categoryId).populate('courses').exec();
            console.log("\n=== DEBUGGING CATEGORY COURSES ===");
            console.log("Category:", categoryWithAllCourses?.name);
            console.log("Total courses in category:", categoryWithAllCourses?.courses?.length);
            if (categoryWithAllCourses?.courses?.length > 0) {
                categoryWithAllCourses.courses.forEach((course, index) => {
                    console.log(`Course ${index + 1}: ${course?.courseName}, Status: "${course?.status}"`);
                });
            }
            
            //get courses for specified categoryId
            const selectedCategory = await Category.findById(categoryId)
                                            .populate({
                                                path: "courses",
                                                match: { status: "Published" },
                                                populate: {
                                                    path: "instructor",
                                                },
                                            })
                                            .exec();
            //validation
            if(!selectedCategory) {
                return res.status(404).json({
                    success:false,
                    message:'Data Not Found',
                });
            }
            
            // Filter out null values from courses array (in case match filters them)
            selectedCategory.courses = selectedCategory.courses.filter(course => course !== null);
            
            console.log("Number of published courses after filter:", selectedCategory.courses.length);
            console.log("=================================\n");
            
            //get courses for different categories
            const differentCategories = await Category.find({
                                         _id: {$ne: categoryId},
                                         })
                                         .populate({
                                            path: "courses",
                                            match: { status: "Published" },
                                            populate: {
                                                path: "instructor",
                                            },
                                        })
                                         .exec();

            // Filter null courses and find first category with courses
            differentCategories.forEach(cat => {
                cat.courses = cat.courses.filter(course => course !== null);
            });

            // Get different category with courses (first one that has courses)
            let differentCategory = differentCategories.find((category) => 
                category.courses.length > 0
            );
            
            if (!differentCategory) {
                differentCategory = { courses: [] };
            }

            // Get top-selling courses across all categories
            const allCategories = await Category.find()
                .populate({
                    path: "courses",
                    match: { status: "Published" },
                    populate: {
                        path: "instructor",
                    },
                })
                .exec();
            
            // Filter out null courses
            allCategories.forEach(cat => {
                cat.courses = cat.courses.filter(course => course !== null);
            });
                
            const allCourses = allCategories.flatMap((category) => category.courses);
            const mostSellingCourses = allCourses
                .sort((a, b) => b.studentsEnrolled.length - a.studentsEnrolled.length)
                .slice(0, 10);

            //return response
            return res.status(200).json({
                success:true,
                data: {
                    selectedCategory,
                    differentCategory,
                    mostSellingCourses,
                },
            });

    }
    catch(error ) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:error.message,
        });
    }
}