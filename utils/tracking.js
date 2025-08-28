// Helper function to get action buttons for vendors based on status
const getVendorActionButtons = (status) => {
  const buttons = [];
  
  switch (status) {
    case 'pending':
      buttons.push(
        {
          action: 'accept',
          label: 'Accept',
          color: 'green',
          type: 'success'
        },
        {
          action: 'reject',
          label: 'Reject',
          color: 'red',
          type: 'danger'
        }
      );
      break;
      
    case 'accepted':
      buttons.push({
        action: 'view_details',
        label: 'View Details',
        color: 'blue',
        type: 'info'
      });
      break;
      
    case 'paid':
      buttons.push(
        {
          action: 'mark_on_the_way',
          label: 'Mark On The Way',
          color: 'brown',
          type: 'warning'
        },
        {
          action: 'view_details',
          label: 'View Details',
          color: 'blue',
          type: 'info'
        }
      );
      break;
      
    case 'on_the_way':
      buttons.push({
        action: 'view_delivery_status',
        label: 'View Delivery Status',
        color: 'brown',
        type: 'info'
      });
      break;
      
    case 'received':
      buttons.push({
        action: 'mark_picked_up',
        label: 'Mark Picked Up',
        color: 'darkblue',
        type: 'primary'
      });
      break;
      
    case 'picked_up':
      buttons.push({
        action: 'view_status',
        label: 'View Status',
        color: 'blue',
        type: 'info'
      });
      break;
      
    case 'completed':
      buttons.push(
        {
          action: 'view_invoice',
          label: 'View Invoice',
          color: 'blue',
          type: 'info'
        },
        {
          action: 'view_review',
          label: 'View Review',
          color: 'purple',
          type: 'secondary'
        }
      );
      break;
      
    case 'claim':
      buttons.push({
        action: 'view_claim',
        label: 'View Claim Details',
        color: 'orange',
        type: 'warning'
      });
      break;
      
    case 'rejected':
      buttons.push({
        action: 'view_details',
        label: 'View Details',
        color: 'gray',
        type: 'secondary'
      });
      break;
      
    default:
      break;
  }
  
  return buttons;
};

modules.exports = {
  getVendorActionButtons
};