import firstValuesOf from "ui/utils/visualisations/helpers/firstValuesOf";

// Combination: A/B J E.
export default ({ projections = {} }) => [
  {
    $group: {
      _id: "$group",
      timestamps: {
        $push: {
          $toDate: "$timestamp",
        },
      },
      ...firstValuesOf(projections),
    },
  },
  {
    $unwind: "$timestamps",
  },
  {
    $sort: {
      timestamps: 1,
    },
  },
  {
    $group: {
      _id: "$_id",
      timestamps: {
        $push: "$timestamps",
      },
      ...firstValuesOf(projections),
    },
  },
  {
    $addFields: {
      count: {
        $sum: {
          $reduce: {
            input: {
              $range: [
                1,
                {
                  $size: "$timestamps",
                },
              ],
            },
            initialValue: [],
            in: {
              $concatArrays: [
                "$$value",
                [
                  {
                    $let: {
                      vars: {
                        spent: {
                          $divide: [
                            {
                              $subtract: [
                                {
                                  $arrayElemAt: [
                                    "$timestamps",
                                    {
                                      $add: ["$$this", 1],
                                    },
                                  ],
                                },
                                {
                                  $arrayElemAt: ["$timestamps", "$$this"],
                                },
                              ],
                            },
                            60000,
                          ],
                        },
                      },
                      in: {
                        $cond: {
                          if: {
                            $gte: ["$$spent", 150],
                          },
                          then: 0,
                          else: {
                            $cond: [
                              {
                                $gte: [
                                  {
                                    $subtract: [
                                      "$$spent",
                                      {
                                        $floor: "$$spent",
                                      },
                                    ],
                                  },
                                  0.5,
                                ],
                              },
                              {
                                $ceil: "$$spent",
                              },
                              {
                                $floor: "$$spent",
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                ],
              ],
            },
          },
        },
      },
    },
  },
];
