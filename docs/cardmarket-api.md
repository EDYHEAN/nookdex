# Cardmarket API: their answer (2026-10-07)

Johan asked Cardmarket for API access, to get prices per card language: their price guide mixes every language of a
card. Their support answered by e-mail on 2026-10-07 (Johan's Outlook, ticket 2529850:2388755).

## In short

- **The API is closed to every new request**, sellers or apps alike, since some access holders abused it. No date to
  reopen: "our IT department is still working on API improvements in the long term". A change will be announced on
  [help.cardmarket.com/en/cardmarket-api](https://help.cardmarket.com/en/cardmarket-api).
- **The Data page** ([cardmarket.com/en/Magic/Data](https://www.cardmarket.com/en/Magic/Data)) has the catalogue and the
  price guide, which used to be API features. Not everything is in them, and they "will try to add more information
  within these files in the future". The price guide is per product, so every language is mixed. Since #53 it's what we
  use for French and Japanese cards (`price_guide_6.json`, fetch-set `applyGuide`).
- **For inventory and price tools**, they point to their API partners, such as
  [TCG PowerTools](https://help.cardmarket.com/en/api-partnerships).

What it means for NookDex: no Cardmarket prices per card language for now. French cards stay on the all-languages
guide, and English cards on TCGplayer. If the Data files ever gain a language split, the price guide is the place to
watch.

## Their message

> Hello Johan,
>
> We appreciate your API request and are glad for the opportunity to clarify our current policy regarding access to our
> API:
>
> https://help.cardmarket.com/en/cardmarket-api
>
> Initially, API access of Cardmarket was granted to users who could meet certain technical criteria set out
> objectively for all users.
>
> However, due to past issues resulting from some API access holders abusing their rights on our platform, we had to
> stop the process and review our policy on this. This is to ensure stability and data security on our platform.
> Unfortunately, for this reason, we are currently unable to approve any requests for API access. This policy applies
> equally to all sellers and is not intended to imply discriminatory or unfair treatment.
>
> Our IT department is still working on API improvements in the long term. Currently, we cannot say when this work will
> be completed.
>
> If you were looking for advanced inventory and price management options, we recommend using TCG PowerTools
> (https://help.cardmarket.com/en/api-partnerships), which offers those features.
>
> We are very sorry that you are not happy with our data. (https://www.cardmarket.com/en/Magic/Data)
>
> The catalogue and price guide downloads were formerly API features, and we moved them to the web interface. As a
> result, not every piece of information you might expect in the files is included. Likewise, not all information in
> these files is necessarily useful for each and every app or project. (We will try to add more information within
> these files in the future.)
>
> If we change our current API policy, we will announce it on our respective web pages. It is, of course, our approach
> is to make the API available to users again in the future.
>
> Thank you for your understanding.
>
> Kind regards,
> David
> Cardmarket Support Team Lead

## Johan's reply (2026-10-07)

Sent the same day. It asks whether we may use their data, what attribution they want, and whether they have an
affiliate program, and it suggests per-language prices. **Waiting for their answer**: add it below when it comes.

> Hello David,
>
> Thank you for the clear and detailed answer. I understand the API is closed for now, and I'll keep an eye on your
> announcements.
>
> Following your suggestion, I looked at the catalogue and Price Guide downloads. They cover what NookDex needs today.
> NookDex (https://nookdex.com) is a free collection tracker for Pokémon TCG players, built as a fan project: players
> file their cards in virtual binders and follow what their collection is worth. Each card shows its Cardmarket trend
> and low price, credited to Cardmarket, with a "See on Cardmarket" link that opens the product page (via idProduct).
> We download the Pokémon Price Guide file once a day.
>
> Before going further, I'd like to make sure we're using your data the way you intend:
>
> - Is it fine for a free, non-commercial site like ours to download the Price Guide and product files once a day and
>   show these prices publicly, credited to Cardmarket and linking to your product pages?
> - Do you have any attribution requirements (wording, use of the Cardmarket name or logo)?
> - If the project ever earns some money (ads or affiliate links), do you run a partner or affiliate program we should
>   join?
>
> One suggestion, in case it helps your roadmap: language-specific prices (French, German, English printings of the
> same card) would be very valuable to collectors. Most of our players collect French cards and often ask us for French
> prices.
>
> Thanks again for your time, and for keeping these files available.
>
> Thanks again David !!
>
> Kind regards,
> Johan
