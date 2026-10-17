package com.codecouture.ithrift.ui.account

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.codecouture.ithrift.BuildConfig
import com.codecouture.ithrift.data.AppSettings
import com.codecouture.ithrift.data.SessionManager
import com.codecouture.ithrift.databinding.FragmentHelpBinding
import com.codecouture.ithrift.databinding.ItemHelpTopicBinding
import com.codecouture.ithrift.ui.BaseFragment

/**
 * The in-app help system, reachable from Account whether or not anyone is
 * signed in.
 *
 * The topics are written as tasks a customer is trying to finish rather than
 * as a tour of our screens, because a person who is stuck does not know what
 * we named the screen they need. The same content is kept in
 * docs/user-guide.md so that the written user documentation and the help in
 * the app cannot drift apart: change one, change the other.
 *
 * The panel at the bottom prints the app version and the server address
 * currently configured. That is there for support, not for decoration -
 * almost every "it isn't working" turns out to be the wrong server address,
 * and this saves walking someone through three screens to read it out.
 */
class HelpFragment : BaseFragment() {

    private var _binding: FragmentHelpBinding? = null
    private val binding get() = _binding!!

    private data class Topic(val title: String, val body: String)

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHelpBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Help", showBack = true)

        val inflater = LayoutInflater.from(requireContext())
        for (topic in topics()) {
            val item = ItemHelpTopicBinding.inflate(inflater, binding.containerTopics, false)
            item.textTopicTitle.text = topic.title
            item.textTopicBody.text = topic.body
            binding.containerTopics.addView(item.root)
        }

        val signedIn = if (isLoggedIn()) {
            SessionManager.getUser(requireContext())?.name ?: "signed in"
        } else {
            "not signed in"
        }
        binding.textDiagnostics.text = buildString {
            appendLine("Version:  ${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE})")
            appendLine("Server:   ${AppSettings.getServerUrl(requireContext())}")
            append("Account:  $signedIn")
        }
    }

    private fun topics(): List<Topic> = listOf(
        Topic(
            "Find something to buy",
            "The Shop tab lists everything in stock, newest first. Use the chips along the top to narrow " +
                "by brand or category. The Search tab is better when you already know what you want: type " +
                "part of a brand or a description, and add a size or condition filter to cut the list down. " +
                "Everything here is second-hand, so each piece is graded Excellent, Very Good, Good or Fair, " +
                "and that grade sits on the photograph."
        ),
        Topic(
            "Understand the condition grades",
            "Excellent means as new, no visible wear. Very Good means lightly worn with no marks. Good means " +
                "worn, with small marks or fading noted in the description. Fair means visible wear, priced " +
                "to match. Read the description before buying a Good or Fair piece, since that is where any " +
                "specific flaw is recorded."
        ),
        Topic(
            "Buy something",
            "Open a piece, check the size and grade, then tap Add to cart. Most items are one-of-a-kind, so " +
                "adding to the cart does not hold it for you. The stock is only reserved when you place the " +
                "order. Open the Cart tab, check the total and tap Checkout. Choose how you want it delivered, " +
                "where to, and how you want to pay, then tap Place order. You will get an order reference " +
                "like ORD-0007."
        ),
        Topic(
            "Choose a size",
            "Open a piece and tap one of the size chips. Only sizes that are in stock are shown, and the " +
                "number next to the quantity tells you how many are left in that size. Shoes run from UK 3 " +
                "to UK 10, tops and dresses from XS to XXL, and trousers and jeans from waist 28 to 44."
        ),
        Topic(
            "Save a piece for later",
            "Open a piece and tap Save to wishlist. Your saved pieces are under Account, then My wishlist, " +
                "and the same list shows on the website. From there you can move a piece to your cart or " +
                "remove it. Saving does not reserve the piece."
        ),
        Topic(
            "Sale prices and promo codes",
            "A piece on sale shows its new price with the old price crossed out. Tap the Sale chip on the " +
                "Shop tab to see only those. If you have a promo code, type it at checkout and tap Apply. " +
                "The discount shows in the summary before you pay. Some codes need a minimum spend, and " +
                "the app tells you how much more to add."
        ),
        Topic(
            "Delivery options and addresses",
            "Standard delivery is R80 and takes 3 to 5 working days. It is free when your order is R1,000 " +
                "or more. Express delivery is R150 and takes 1 to 2 working days. Collecting from the " +
                "Pretoria store is free. Save your addresses under Account, then Delivery addresses, and " +
                "pick one at checkout. Your default address is chosen for you."
        ),
        Topic(
            "Cancel an order",
            "Open the order from the Orders tab and tap Cancel this order. You can cancel while the order " +
                "is still Processing. Once it has shipped it cannot be cancelled, but you can return it " +
                "after it arrives. A paid order is refunded when you cancel."
        ),
        Topic(
            "Return an item",
            "You have 30 days from delivery. Open the delivered order, tap Return this item next to the " +
                "piece and choose a reason. Follow the return under Account, then My returns: it moves " +
                "from Requested to Approved and then Refunded."
        ),
        Topic(
            "Track an order",
            "The Orders tab lists everything you have bought, newest first, with its current stage: " +
                "Processing, Shipped, Delivered or Cancelled. Open an order to see what is in it, what you " +
                "paid, and the courier reference once the parcel has been handed over."
        ),
        Topic(
            "Change your details or your password",
            "Go to Account, then Settings. Your name, phone number and delivery address are saved to your account, so " +
                "the website shows the same details. Changing your password asks for your current one first. " +
                "If you signed in with Google there is no password section, because Google holds your " +
                "password, not us."
        ),
        Topic(
            "Switch to dark mode",
            "Account → Settings → Appearance. Choose Always dark, Always light, or Follow the system " +
                "setting, which is the default. The change applies immediately and only affects this phone."
        ),
        Topic(
            "Sign in with Google",
            "On the sign-in screen, tap Continue with Google and choose an account. We never see your Google " +
                "password: Google gives the app a signed token, and our server checks that token with Google " +
                "before letting you in. If the button is not there, this build has no Google sign-in " +
                "configured, so sign in with your email and password instead."
        ),
        Topic(
            "\"Couldn't reach the server\"",
            "The app is pointed at the wrong address, or the server is not running. Go to Account → " +
                "Settings → Connection and tap Test connection: it will tell you which. On a real phone the " +
                "address must be the computer's address on your network, for example " +
                "http://192.168.0.10:3000. Typing localhost on a phone means the phone itself, " +
                "which is not running anything."
        ),
    )

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
