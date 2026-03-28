interface QuotationResDto {
    id: string,
    buyer: BuyerDto,
    quotation: QuotationListResDto[],
    status: number,
    createdAt: string,
    updatedAt: string
}

interface QuotationListResDto {
    id: string,
    typeId: string,
    typeName: string,
    plus: number,
    price: number,
    percent: number,
    weight: number,
    perGram: number,
    total: number,
    status: number,
    createdAt: string,
    updatedAt: string
}

interface BuyerDto {
    id: string,
    username?: string,
    image: string,
    fname: string,
    lname: string,
    phone: string,
    credits?: number,
    status: number,
    createdAt: string,
    updatedAt: string
}