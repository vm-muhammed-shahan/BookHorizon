const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const mongoose = require("mongoose");




const getDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      const filterType = req.query.filter || 'yearly';
      let matchStage = {};

      // Set date range based on filter with IST awareness
      const now = new Date(); // Current time in local system time (likely IST)
      now.setUTCHours(now.getUTCHours() + 5.5); // Adjust to IST explicitly
      if (filterType === 'yearly') {
        matchStage = {
          createdOn: {
            $gte: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
            $lte: new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59)),
          },
        };
      } else if (filterType === 'monthly') {
        matchStage = {
          createdOn: {
            $gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
            $lte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
          },
        };
      } else if (filterType === 'weekly') {
        const startOfWeek = new Date(now);
        startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay()); // Start of current week (Sunday in UTC, adjusted to IST)
        startOfWeek.setUTCHours(0, 0, 0, 0);
        const endOfWeek = new Date(now); // Up to current moment
        endOfWeek.setUTCHours(23, 59, 59, 999);
        matchStage = { createdOn: { $gte: startOfWeek, $lte: endOfWeek } };
        console.log('Weekly Range (UTC):', startOfWeek.toISOString(), 'to', endOfWeek.toISOString());
      }

      // Total Sales Aggregation with all days ensured
      const salesData = await Order.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Returned'] }, ...matchStage } },
        {
          $facet: {
            data: [
              {
                $group: {
                  _id: filterType === 'yearly' ? { $month: '$createdOn' } :
                        filterType === 'monthly' ? { $dayOfMonth: '$createdOn' } :
                        { $dayOfWeek: '$createdOn' },
                  totalSales: { $sum: '$finalAmount' },
                },
              },
              { $sort: { '_id': 1 } },
            ],
            allDays: [
              { $group: { _id: null, allDates: { $push: '$createdOn' } } },
              {
                $project: {
                  days: {
                    $map: {
                      input: { $range: [1, filterType === 'yearly' ? 13 : filterType === 'monthly' ? new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate() + 1 : 8] },
                      as: "day",
                      in: "$$day"
                    }
                  }
                }
              },
              { $unwind: '$days' },
              {
                $group: {
                  _id: '$days',
                  totalSales: { $sum: 0 } // Default to 0 if no data
                }
              },
              {
                $lookup: {
                  from: "orders",
                  let: { day: '$_id' },
                  pipeline: [
                    { $match: { status: { $nin: ['Cancelled', 'Returned'] }, ...matchStage } },
                    {
                      $project: {
                        dayOfWeek: { $dayOfWeek: '$createdOn' },
                        sales: '$finalAmount'
                      }
                    },
                    { $match: { $expr: { $eq: ['$dayOfWeek', '$$day'] } } },
                    {
                      $group: {
                        _id: '$dayOfWeek',
                        totalSales: { $sum: '$sales' }
                      }
                    }
                  ],
                  as: 'salesData'
                }
              },
              { $unwind: { path: '$salesData', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: '$_id',
                  totalSales: { $ifNull: ['$salesData.totalSales', 0] }
                }
              }
            ]
          }
        },
        { $project: { combined: { $concatArrays: ['$data', '$allDays'] } } },
        { $unwind: '$combined' },
        {
          $group: {
            _id: '$combined._id',
            totalSales: { $sum: '$combined.totalSales' }
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      console.log('Sales Data:', salesData);

      // Prepare chart data
      const labels = filterType === 'yearly' ?
        ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] :
        filterType === 'monthly' ?
        Array.from({ length: new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate() }, (_, i) => i + 1) :
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      const sales = Array(labels.length).fill(0);
      salesData.forEach(item => {
        const index = item._id - 1;
        if (index >= 0 && index < sales.length) {
          sales[index] = item.totalSales || 0;
        }
      });

      // Calculate total orders and average order value across all time
      const totalOrdersResult = await Order.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ]);
      const totalOrders = totalOrdersResult.length > 0 ? totalOrdersResult[0].total : 0;

      // Calculate total sales across all time
      const totalSalesResult = await Order.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ]);
      const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].total : 0;

      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Top 10 Best-Selling Products
      const topProducts = await Order.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
        { $unwind: '$orderedItems' },
        {
          $group: {
            _id: '$orderedItems.product',
            totalSold: { $sum: '$orderedItems.quantity' },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $project: {
            productName: '$product.productName',
            totalSold: 1,
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ]);

      // Top 10 Best-Selling Categories
      const topCategories = await Order.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
        { $unwind: '$orderedItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderedItems.product',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: '$product.category',
            totalSold: { $sum: '$orderedItems.quantity' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: '$category' },
        {
          $project: {
            categoryName: '$category.name',
            totalSold: 1,
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ]);

      res.render('dashboard', {
        salesData: sales,
        labels,
        filterType,
        topProducts,
        topCategories,
        totalSales,
        totalOrders,
        avgOrderValue,
      });
    } catch (error) {
      console.error(error);
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};

module.exports = {
  getDashboard
}


