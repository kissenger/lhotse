export const shippingOptions = {
  SHIPPING_OPTIONS: [
    {
      packageType: "Letter",
      maxWeight: 100,
      maxDimensions: {
        thickness: 5,
        width: 165,
        length: 240
      },
      packaging: {
        weight: 45,
      },
      services: [{
        label: "Royal Mail 2nd Class",
        cost: 0.87
      },{
        label: "Royal Mail 1st Class",
        cost: 1.70         
      }]
    },{
      packageType: "Large Letter",
      maxWeight: 1000,
      maxDimensions: {
        thickness: 25,
        width: 250,
        length: 353
      },
      packaging: {
        weight: 75,
      },
      services: [{
        label: "Royal Mail Tracked 48",
        cost: 2.70
      },{
        label: "Royal Mail Tracked 24",
        cost: 3.60,
      }]
    },{
      packageType: "Small Parcel",
      maxWeight: 2000,
      maxDimensions: {
        thickness: 160,
        width: 350,
        length: 450
      },
      packaging: {
        weight: 75,
      },
      services: [{
        label: "Royal Mail Tracked 48",
        cost: 3.45
      },{
        label: "Royal Mail Tracked 24",
        cost: 4.29,
      }]
    },{
      packageType: "Medium Parcel",
      maxWeight: 4000,
      maxDimensions: {
        thickness: 460,
        width: 460,
        length: 610
      },
      packaging: {
        weight: 300,
      },
      services: [{
        label: "Royal Mail Tracked 48",
        cost: 6.80
      },{
        label: "Royal Mail Tracked 24",
        cost: 7.90,
      }]  
    }
  ]  
};