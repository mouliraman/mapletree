# Mapletree Wallet
Every user will have a Mapletree Wallet. On 1'st April the wallet balance will be 0. User can load up the wallet by transfering money through FonePaisa. Admin can load up the wallet by registering the cheque submitted by user or card swiped in an online mode. Moreover admin will be able to add credit via refunds for previous corrected invoice.

## Wallet
The idea is very simple. The wallet is a place where money is parked. The wallet can be filled either by the user using online transaction or admin by registering offline transaction. The wallet is debited for any delivered invoice.

## Transactions
Each action in the wallet will be a transaction. Following are the list of supported transactions.
 * **invoice** : A transaction where the money is deducted from the wallet to pay for an invoice. The invoice id will be associated for easy reference. The amount deducted will be same as the one in the invoice.
 * **cheque** : A credit transaction when a user provides a cheque. Admin will be able to enter this. He should make sure that the cheque number is also mentioned.
 * **card-swipe** : Same as above. Offline transaction registerd by admin.
 * **refund** : When a refund is provided by the admin for whatever reason. Can be entered same as above.
 * **fonepaisa** : When money is transfered by the user to their wallet. This is also a credit transaction.

## Typical workflow
1. User comes to the mapletree website and places his order.
2. When the user submits the order, a pop-up window appears asking the user to pay the balance amount (wallet balance - invoice amount)
3. User makes the payment and the money is added to the wallet (The final invoice is not yet raised)
4. On the day of packing the Admin will save the order as per what is being ordered. It is possible the invoice amount reduces or increases (slightly)
5. When the full packing is complete, the admin will hit the "Deliver" button. This will generate the final invoice.
6. A new transaction is created which debits amount from the Wallet for the final invoice. It is possible that the Wallet will have a negative or positive balance.
7. User may accept the invoice and nothing needs to be done. The balance (positive or negative) will be adjusted in next order.
8. User protests and says that the carrot are not good and I'll not pay for them. 
9. There are two choices for the Admin now
   - He can go back to the order (from admin view) and reduce quantity of carrot to 0. The invoice will automatically be adjusted. No separate **refund** needs to be created.
   - He can add a **refund** transaction for the amount and specify the reason. The amount will be credited back to the users wallet.
## User Interface

### Wallet
When a user logins she will see a wallet link at top right corner along with the wallet balance. On 1'st April everyone will have Rs. 0/- in their wallet balance. When they click on the wallet they can see their complete transaction history and option to load up their wallet by specifying the amount of money to transfer. This transfer will happen only via FonePaisa Payment gateway. Both successful and failure transactions will be shown here. If the user clicked on pay and did not complete the transaction it will be shown as **processing**.

Following are what the user can do
 * Complete transactions will be shown in a table. When the number of transactions increases we will think about pagination. Till then ALL transactions will be shown.

 * The wallet balance is prominently shown.

 * A simlple form to specify the amount to load the wallet. When amount is entered and "Add Money" is entered, a pop-up appears for confirmation. On confirming the user is taken to Fonepaisa website to complete the transaction. Once completed the user comes back to the Mapletree website and she will see the amount credited and balance increase.
 
### Shopping
If the Wallet balance goes below ```Rs -2000/-```, the user will not be able to place order. A message will appear on the top asking the user to load up the wallet. Only online payment (Fonepaisa) will help. If the admin wants to make an exception and allow the user to shop, he should make an offline credit and track it offline.
 
If the Wallet balance is above ```Rs -2000/-```, the user will be able to shop. If the ```wallet balance``` - ```invoice amount``` is less than zero the order goes through and the user does not have to make any payment. If the difference is more than zero, a popup appears asking the user to make the difference amount payment. Below the ```payment``` button we also provide a message saying that the user can made offlice payment via cheque or card-swipe to the delivery boy. So she need not make the payment.

Examples
 * Wallet balance Rs -2300/-. No shopping.
 * Wallet balance 0, shopping Rs. 1300/-. Pay Rs. 1300/-.
 * Wallet balance 232, shopping Rs. 200/-. No need to pay.
 * Wallet balance 232, shopping Rs. 300/-. Pay Rs 68/-.
 * Wallet balance -232, shopping Rs. 232/-. Pay Rs. 464/-.
 
 ## Admin Interface
 
 ### Prepare order
 There is no change in the workflow. Things happen in the backend, but you should be aware of when the Wallet is debited. When clicking on the **Deliver** button, the users wallet will be debited. Also note that you can change the invoice even after clicking on **Deliver** button. Difference will be adjusted. There will not be any duplicate debit.
 
 ### View users wallet
 In the Users tab a new column is added showing the user's balance. On clicking a popup appears. Here the admin can do the following
 * View all the transactions of the user.
 * Create a offline transaction or a refund.
 
 Please note that transaction cannot be edited. Please ensure mistake is not made while entering offline transaction.
 
