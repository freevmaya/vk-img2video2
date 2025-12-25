<?
class VKUserModel extends BaseModel {
	
	protected function getTable() {
		return 'users';
	}

	public function ChangeBalance($user_id, $payload, $addValue, $transactionsType, $data)
	{
		(new TransactionsModel())->Add($user_id, $payload, $addValue, $transactionsType, $data);
		$this->RefreshBalance($user_id);
	}

	public function RefreshBalance($user_id)
	{
        $balance = (new TransactionsModel())->Balance($user_id);
        return !is_null($balance) ? $this->Update([
        	'id'=>$user_id,
        	'balance'=>$balance
        ]) : false;
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'vk_user_id' => [
				'label' => 'vk_user_id',
				'dbtype' => 'i'
			],
			'vk_ok_user_id' => [
				'label' => 'vk_ok_user_id',
				'dbtype' => 'i'
			],
			'first_name' => [
				'label' => 'first_name',
				'dbtype' => 's'
			],
			'last_name' => [
				'label' => 'last_name',
				'dbtype' => 's'
			],
			'photo_url' => [
				'label' => 'photo_url',
				'dbtype' => 's'
			],
			'access_token' => [
				'label'=> 'access_token',
				'dbtype' => 's'
			],
			'balance' => [
				'label'=> 'balance',
				'dbtype' => 'd'
			],
			'created_at' => [
				'label'=> 'created_at',
				'dbtype' => 's'
			],
			'updated_at' => [
				'label'=> 'updated_at',
				'dbtype' => 's'
			],
			'accepted_at' => [
				'label'=> 'accepted_at',
				'dbtype' => 's'
			]
		];
	}
}